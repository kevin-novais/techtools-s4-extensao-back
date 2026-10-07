import s4DotzClient from "@/database/clients/s4DotzClient";
import { VexpensesApi } from "@/cron/modules/vexpenses/http/VexpensesApi";
import { format, utcToZonedTime } from "date-fns-tz";
import log from "@/util/logger";

const PROCESSABLE_DB_STATUSES = new Set(["INTEGRADO_SAP", "ERRO_INTEGRACAO_VEXPENSES"]);
const CHUNK_SIZE = 500;
// Linha do parceiro (fornecedor/Kreditor): e a unica linha aberta do documento AP que
// de fato compensa na baixa. Restringe a deteccao para nao casar por uma linha de razao
// que eventualmente venha marcada como cleared por outro motivo.
const PARTNER_FINANCIAL_ACCOUNT_TYPE = "K";
const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const PAYMENT_COMMENT = "Pagamento identificado automaticamente por baixa contabil no SAP.";

type ControleExpenseCandidate = {
  reportId: number;
  codigoDocumentoERP: string | null;
  codigoCia: string | null;
  fiscalYear: string | null;
};

type PaymentByClearingMetrics = {
  eligibleRecords: number;
  eligibleReports: number;
  matchedReports: number;
  paidReports: number;
  ignoredReports: number;
  errorReports: number;
};

export class VexpensesPaymentByClearingService {
  private readonly vexpensesApi: Pick<VexpensesApi, "payReport">;

  constructor(vexpensesApi?: Pick<VexpensesApi, "payReport">) {
    this.vexpensesApi = vexpensesApi ?? new VexpensesApi();
  }

  async execute(): Promise<PaymentByClearingMetrics> {
    const metrics: PaymentByClearingMetrics = {
      eligibleRecords: 0,
      eligibleReports: 0,
      matchedReports: 0,
      paidReports: 0,
      ignoredReports: 0,
      errorReports: 0,
    };

    log.info("[VexpensesPaymentByClearingService] Iniciando processamento de pagamentos por baixa contabil");
    const eligibleRecords = await this.fetchEligibleControleExpenses();
    metrics.eligibleRecords = eligibleRecords.length;

    if (!eligibleRecords.length) {
      log.info("[VexpensesPaymentByClearingService] Nenhum registro elegivel no controle_expense");
      this.logSummary(metrics);
      return metrics;
    }

    const groupedByReport = this.groupByReportId(eligibleRecords);
    metrics.eligibleReports = groupedByReport.size;

    const accountingDocuments = this.extractAccountingDocuments(eligibleRecords);

    if (!accountingDocuments.length) {
      metrics.ignoredReports = metrics.eligibleReports;
      log.warn("[VexpensesPaymentByClearingService] Nenhum codigo_documento_erp valido encontrado nos elegiveis");
      this.logSummary(metrics);
      return metrics;
    }

    const clearingDateByDocument = await this.fetchClearingDatesByDocument(accountingDocuments);

    for (const [reportId, entries] of groupedByReport.entries()) {
      const selectedClearingDate = this.selectClearingDateForReport(entries, clearingDateByDocument);

      if (!selectedClearingDate) {
        metrics.ignoredReports += 1;
        const documents = entries.map((entry) => entry.codigoDocumentoERP).filter(Boolean).join(",");
        log.info(
          `[VexpensesPaymentByClearingService] Report ${reportId} ignorado: sem baixa contabil (IsCleared=true/ClearingDate). Documentos=${documents}`,
        );
        continue;
      }

      metrics.matchedReports += 1;
      const paymentDate = this.formatPaymentDate(selectedClearingDate);

      try {
        await this.vexpensesApi.payReport(reportId, {
          payment_date: paymentDate,
          comment: PAYMENT_COMMENT,
        });
        await this.updateReportStatus(reportId, "INTEGRADO_VEXPENSES", null);
        metrics.paidReports += 1;
        log.info(
          `[VexpensesPaymentByClearingService] Pagamento enviado com sucesso. report_id=${reportId} payment_date=${paymentDate}`,
        );
      } catch (error) {
        metrics.errorReports += 1;
        const message = this.extractErrorMessage(error);
        await this.updateReportStatus(reportId, "ERRO_INTEGRACAO_VEXPENSES", message);
        const document = entries[0]?.codigoDocumentoERP ?? "N/A";
        log.error(
          `[VexpensesPaymentByClearingService] Erro ao enviar pagamento. report_id=${reportId} codigo_documento_erp=${document} erro=${message}`,
        );
      }
    }

    this.logSummary(metrics);
    return metrics;
  }

  private async fetchEligibleControleExpenses(): Promise<ControleExpenseCandidate[]> {
    const items = await s4DotzClient.controleExpense.findMany({
      where: {
        status: {
          in: Array.from(PROCESSABLE_DB_STATUSES),
        },
        codigoDocumentoERP: {
          not: null,
        },
      },
      select: {
        reportId: true,
        codigoDocumentoERP: true,
        codigoCia: true,
        fiscalYear: true,
      },
    });

    return items.map(
      (item: { reportId: number; codigoDocumentoERP: string | null; codigoCia: string | null; fiscalYear: string | null }) => ({
        reportId: item.reportId,
        codigoDocumentoERP: item.codigoDocumentoERP?.trim() ?? null,
        codigoCia: item.codigoCia?.trim() ?? null,
        fiscalYear: item.fiscalYear?.trim() ?? null,
      }),
    );
  }

  // Chave do documento SAP: company_code + fiscal_year + accounting_document.
  // O numero do documento (accounting_document) NAO e unico: repete entre CIAs/anos,
  // entao a baixa precisa ser amarrada pela chave completa do cabecalho.
  private buildDocumentKey(companyCode: string, fiscalYear: string, accountingDocument: string): string {
    return `${companyCode}|${fiscalYear}|${accountingDocument}`;
  }

  private groupByReportId(items: ControleExpenseCandidate[]): Map<number, ControleExpenseCandidate[]> {
    const grouped = new Map<number, ControleExpenseCandidate[]>();

    for (const item of items) {
      const current = grouped.get(item.reportId) ?? [];
      grouped.set(item.reportId, [...current, item]);
    }

    return grouped;
  }

  private extractAccountingDocuments(items: ControleExpenseCandidate[]): string[] {
    const documents = new Set<string>();

    for (const item of items) {
      if (!item.codigoDocumentoERP) {
        continue;
      }
      documents.add(item.codigoDocumentoERP);
    }

    return Array.from(documents);
  }

  private async fetchClearingDatesByDocument(documents: string[]): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    const chunks = this.chunkArray(documents, CHUNK_SIZE);

    for (const chunk of chunks) {
      const rows = await s4DotzClient.accountingDocumentItem.findMany({
        where: {
          AccountingDocument: {
            in: chunk,
          },
          FinancialAccountType: PARTNER_FINANCIAL_ACCOUNT_TYPE,
          IsCleared: "X",
          ClearingDate: {
            not: null,
          },
        },
        select: {
          CompanyCode: true,
          FiscalYear: true,
          AccountingDocument: true,
          ClearingDate: true,
        },
      });

      for (const row of rows) {
        if (!row.ClearingDate) {
          continue;
        }

        // Chave completa do cabecalho: a baixa de um documento de uma CIA/ano nao pode
        // contaminar um documento homonimo de outra CIA/ano.
        const key = this.buildDocumentKey(row.CompanyCode, row.FiscalYear, row.AccountingDocument);
        const existing = result.get(key);
        if (!existing || row.ClearingDate > existing) {
          result.set(key, row.ClearingDate);
        }
      }
    }

    return result;
  }

  private selectClearingDateForReport(
    entries: ControleExpenseCandidate[],
    clearingDateByDocument: Map<string, Date>,
  ): Date | null {
    let selectedDate: Date | null = null;

    for (const entry of entries) {
      if (!entry.codigoDocumentoERP) {
        continue;
      }

      // Sem CIA/ano fiscal nao da para amarrar a chave do documento: ignora para nao
      // arriscar falso positivo por colisao de numero de documento.
      if (!entry.codigoCia || !entry.fiscalYear) {
        log.warn(
          `[VexpensesPaymentByClearingService] Report ${entry.reportId} sem codigo_cia/fiscal_year: baixa nao conciliada (documento=${entry.codigoDocumentoERP}).`,
        );
        continue;
      }

      const key = this.buildDocumentKey(entry.codigoCia, entry.fiscalYear, entry.codigoDocumentoERP);
      const clearingDate = clearingDateByDocument.get(key);
      if (!clearingDate) {
        continue;
      }

      if (!selectedDate || clearingDate > selectedDate) {
        selectedDate = clearingDate;
      }
    }

    return selectedDate;
  }

  private formatPaymentDate(date: Date): string {
    const brazilDate = utcToZonedTime(date, BRAZIL_TIMEZONE);
    return format(brazilDate, "yyyy-MM-dd HH:mm:ss", { timeZone: BRAZIL_TIMEZONE });
  }

  private async updateReportStatus(
    reportId: number,
    status: "INTEGRADO_VEXPENSES" | "ERRO_INTEGRACAO_VEXPENSES",
    errorMessage: string | null,
  ): Promise<void> {
    await s4DotzClient.controleExpense.updateMany({
      where: {
        reportId,
      },
      data: {
        status,
        error_message: errorMessage ?? undefined,
        dataIntegracaoPagamento: status === "INTEGRADO_VEXPENSES" ? new Date() : undefined,
        atualizadoEm: new Date(),
      },
    });
  }

  private extractErrorMessage(error: unknown): string {
    const maybeError = error as { response?: { data?: { mensagem?: unknown } }; message?: string };
    const responseMessage = maybeError.response?.data?.mensagem;

    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (maybeError.message?.trim()) {
      return maybeError.message;
    }

    return "Erro desconhecido ao enviar pagamento para vExpenses";
  }

  private logSummary(metrics: PaymentByClearingMetrics): void {
    log.info(
      `[VexpensesPaymentByClearingService] Resumo: elegiveis_registros=${metrics.eligibleRecords}, elegiveis_reports=${metrics.eligibleReports}, conciliados=${metrics.matchedReports}, pagos=${metrics.paidReports}, ignorados=${metrics.ignoredReports}, erros=${metrics.errorReports}`,
    );
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0) {
      return [items];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }
}

