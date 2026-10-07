import log from "@/util/logger";
import apm from "@/apm";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { Config } from "@/config/config";
import { RegistrosContabeisApi } from "@/cron/modules/registros-contabeis/http/RegistrosContabeisApi";
import {
  AccountingDocumentItemNormalized,
  SapJournalEntryItem,
} from "@/cron/modules/registros-contabeis/types/registros-contabeis.types";
import { SQL_RESOLVE_CONTA_ORIGEM_XTPG } from "@/cron/modules/registros-contabeis/sql/resolveContaOrigemXtpg";
import { formatMillisecondsToHHMMSS, parseDateForFilter } from "@/util/date";
import { format } from "date-fns";

const CHUNK_SIZE = 100;

// Guarda contra loop infinito na paginação in-run (SAP ignorando Skip ou header
// total-itens ausente). Em operação normal o laço termina por total-itens/página parcial.
const MAX_PAGINAS = 1000;

const UPDATE_DIFF_FIELDS: Array<keyof AccountingDocumentItemNormalized> = [
  "NetDueDate",
  "DocumentReferenceID",
  "AmountInCompanyCodeCurrency",
  "WithholdingTaxAmount",
  "CashDiscountAmtInCoCodeCrcy",
  "PaymentMethod",
  "AccountingDocumentHeaderText",
  "DocumentItemText",
  "LastChangeDate",
  "ClearingAccountingDocument",
  "ReverseDocument",
  "IsReversed",
  "ClearingIsReversed",
  "ClearingDate",
  "ReverseDocumentFiscalYear",
  "ClearingDocFiscalYear",
  "ClearingItem",
];

/// (DTZ-273) Congelam o vinculo de compensacao. O S/4 apaga clearing_* quando a
/// compensacao e revertida e o update grava o payload inteiro, entao o vazio
/// sobrescreveria o vinculo entre pagamento e fatura. Estes campos so podem ser
/// gravados, nunca apagados.
const STICKY_CLEAR_FIELDS = [
  "StickyClearAccDoc",
  "StickyClearDocFiscalYear",
  "StickyClearItem",
] as const;

const DECIMAL_UPDATE_DIFF_FIELDS = new Set<keyof AccountingDocumentItemNormalized>([
  "AmountInCompanyCodeCurrency",
  "WithholdingTaxAmount",
  "CashDiscountAmtInCoCodeCrcy",
]);

const MAX_FIELD_LENGTHS: Record<string, number> = {
  CompanyCode: 4,
  FiscalYear: 4,
  AccountingDocument: 10,
  AccountingDocumentItem: 3,
  ChartOfAccounts: 10,
  AccountingDocumentItemType: 2,
  ClearingAccountingDocument: 10,
  StickyClearAccDoc: 10,
  StickyClearDocFiscalYear: 4,
  StickyClearItem: 3,
  IsCleared: 1,
  PostingKey: 2,
  FinancialAccountType: 1,
  DebitCreditCode: 1,
  BusinessArea: 4,
  PartnerBusinessArea: 4,
  TaxCode: 2,
  WithholdingTaxCode: 2,
  TaxType: 2,
  TransactionTypeDetermination: 3,
  AssignmentReference: 18,
  DocumentItemText: 50,
  ControllingArea: 4,
  CostCenter: 10,
  Project: 12,
  OrderID: 12,
  BillingDocument: 10,
  SalesDocument: 10,
  SalesDocumentItem: 6,
  FixedAsset: 4,
  AssetTransactionType: 3,
  OperationalGLAccount: 10,
  GLAccount: 10,
  Customer: 10,
  Supplier: 10,
  ProfitLossAccountType: 1,
  PaymentTerms: 4,
  CashDiscount1Days: 3,
  CashDiscount2Days: 3,
  NetPaymentDays: 3,
  PaymentReason: 4,
  PaymentMethod: 1,
  PaymentBlockingReason: 1,
  HouseBank: 5,
  BPBankAccountInternalID: 4,
  InvoiceReference: 10,
  InvoiceReferenceFiscalYear: 4,
  InvoiceItemReference: 3,
  Plant: 4,
  PurchasingDocument: 10,
  ProfitCenter: 10,
  ClearingIsReversed: 1,
  AlternativeGLAccount: 10,
  PaymentReference: 30,
  ClearingItem: 3,
  BusinessPlace: 4,
  FunctionalArea: 16,
  ClearingDocFiscalYear: 4,
  HouseBankAccount: 5,
  ReferenceDocumentType: 10,
  OriginalReferenceDocument: 20,
  FiscalPeriod: 3,
  AccountingDocumentType: 2,
  CompanyCodeCurrency: 5,
  TransactionCurrency: 5,
  BalanceTransactionCurrency: 5,
  AdditionalCurrency1: 5,
  CreationTime: 11,
  AccountingDocCreatedByUser: 12,
  DocumentReferenceID: 20,
  ReverseDocument: 10,
  ReverseDocumentFiscalYear: 4,
  AccountingDocumentHeaderText: 25,
  ReversalReason: 2,
  IsReversal: 1,
  IsReversed: 1,
  BusinessTransactionType: 10,
  CompanyCodeName: 30,
  BusinessAreaName: 30,
  ControllingAreaName: 30,
  CostCenterName: 30,
  FunctionalAreaName: 30,
  AccountingDocumentCategoryName: 30,
  AccountingDocumentTypeName: 30,
  SegmentName: 30,
  ProfitCenterName: 30,
  GLAccountLongName: 50,
  Reference1IDByBusinessPartner: 20,
  Reference2IDByBusinessPartner: 30,
  Reference3IDByBusinessPartner: 50,
};

type SyncMetrics = {
  totalReceived: number;
  inserted: number;
  updated: number;
  updatedStatusXtpg: number;
  ignored: number;
  invalid: number;
  revertedCleared: number;
  contasCriadas: number;
  contaOrigemResolvida: number;
};

type AccountingDocumentItemKey = {
  CompanyCode: string;
  FiscalYear: string;
  AccountingDocument: string;
  AccountingDocumentItem: string;
};

// DTZ-318 AR: referencia de um recebimento direto BankPlus (contas a receber). A fatura AR nao
// e decodificavel da assignment_reference (que carrega o boleto, nao o accounting_document),
// entao o vinculo e feito por payment_reference = document_reference_id (o boleto).
type RecebimentoDiretoBankplusARRef = {
  CompanyCode: string;
  DocumentReferenceID: string;
};

type UpdateDiffFieldValues = Partial<Record<keyof AccountingDocumentItemNormalized, unknown>>;

// DTZ-249: dados mínimos p/ auto-criar a conta em `contas_contabeis` a partir do registro.
type NovaContaContabil = {
  ChartOfAccounts: string;
  CompanyCode: string;
  GLAccount: string;
  GLAccountName: string;
  GLAccountECD: string | null;
};

export class SyncRegistrosContabeisService {
  constructor(
    private readonly registrosContabeisApi: RegistrosContabeisApi = new RegistrosContabeisApi(),
  ) {}

  async execute(): Promise<SyncMetrics> {
    const filterDate = this.buildFilterDate();
    const top = Config.SYNC_REGISTROS_CONTABEIS_PAGE_SIZE;
    const timeStart = performance.now();

    log.info(`[SyncRegistrosContabeisService] Filter date: ${filterDate} | top=${top}`);

    const metrics: SyncMetrics = {
      totalReceived: 0,
      inserted: 0,
      updated: 0,
      updatedStatusXtpg: 0,
      ignored: 0,
      invalid: 0,
      revertedCleared: 0,
      contasCriadas: 0,
      contaOrigemResolvida: 0,
    };

    // DTZ-245 / DTZ-249: acumulados ao longo de TODAS as páginas do run e aplicados uma
    // única vez no fim, preservando a invariante "um sync = conjunto completo do dia" de
    // que esses dois pontos dependem. A paginação abaixo é in-run: percorre o dia inteiro
    // numa única execução (resolve o "parava na primeira busca") sem fragmentar a detecção
    // de reversão nem a auto-criação de contas.
    const reversalDocs = new Map<string, { CompanyCode: string; AccountingDocument: string }>();
    const novasContas = new Map<string, NovaContaContabil>();
    // DTZ-318: faturas baixadas por pagamento BankPlus SEM doc de compensacao (baixa direta,
    // clearing NULL). O S/4 nao popula clearing_* nessas baixas, entao a fatura nunca era
    // marcada como liquidada e o previsto nao ia a zero. Coletadas na chegada do pagamento e
    // resetadas ao fim do run para reentrarem no previsto (bloco 'Prev liquidados Bank Direto').
    const faturasBaixaDiretaBankplus = new Map<string, AccountingDocumentItemKey>();
    // DTZ-318 AR: recebimentos de contas a receber via BankPlus SEM doc de compensacao (retorno
    // bancario, clearing NULL). Igual ao AP, o S/4 nao popula clearing_*, entao a fatura AR nunca
    // e marcada como liquidada e o previsto nao ia a zero. Coleta o document_reference_id (boleto)
    // na chegada do recebimento; ao fim do run reseta as faturas casadas por payment_reference
    // para reentrarem no previsto (bloco 'Prev liquidados AR Bank Direto').
    const recebimentosDiretoBankplusAR = new Map<string, RecebimentoDiretoBankplusARRef>();

    let skip = 0;
    let totalItens = 0;
    let paginas = 0;

    for (;;) {
      const page = await this.registrosContabeisApi.execute({ data: filterDate, skip, top });
      totalItens = page.totalItens;

      if (!page.items.length) {
        break;
      }

      paginas += 1;
      metrics.totalReceived += page.items.length;
      await this.processarPagina(page.items, metrics, reversalDocs, novasContas, faturasBaixaDiretaBankplus, recebimentosDiretoBankplusAR);

      const nextSkip = skip + page.items.length;

      // Fim do conjunto pelo total informado no header.
      if (totalItens > 0 && nextSkip >= totalItens) {
        break;
      }
      // Última página incompleta (defensivo p/ quando total-itens não vier).
      if (page.items.length < top) {
        break;
      }
      // Guarda contra loop infinito (SAP ignorando Skip / total-itens ausente).
      if (paginas >= MAX_PAGINAS) {
        log.warn(
          `[SyncRegistrosContabeisService] Limite de ${MAX_PAGINAS} páginas atingido; ` +
            `interrompendo a paginação (skip=${nextSkip}, total-itens=${totalItens}).`,
        );
        break;
      }

      skip = nextSkip;
    }

    if (!metrics.totalReceived) {
      log.info("[SyncRegistrosContabeisService] Nenhum registro contábil recebido");
      return metrics;
    }

    // DTZ-245: roda por ÚLTIMO, após os inserts/updates de todas as páginas, para que a
    // limpeza vença qualquer repopulação de clearing_* feita no caminho toUpdate.
    if (reversalDocs.size) {
      metrics.revertedCleared = await this.limparFilhosRevertidos([...reversalDocs.values()]);
    }

    // DTZ-249: idem, uma vez sobre o conjunto completo do dia.
    if (novasContas.size) {
      metrics.contasCriadas = await this.autoCriarContasContabeis([...novasContas.values()]);
    }

    // DTZ-318: reseta as faturas baixadas por baixa direta BankPlus, para reentrarem no
    // previsto e irem a zero (roda depois da limpeza da reversao, mesma ordem do DTZ-245).
    if (faturasBaixaDiretaBankplus.size) {
      await this.resetarFaturasBaixaDiretaBankplus([...faturasBaixaDiretaBankplus.values()]);
    }

    // DTZ-318 AR: reseta as faturas AR baixadas por recebimento direto BankPlus (casadas por
    // payment_reference), para reentrarem no previsto e irem a zero (bloco 'Prev liquidados AR
    // Bank Direto'). Mesma ordem: depois da limpeza da reversao.
    if (recebimentosDiretoBankplusAR.size) {
      await this.resetarFaturasRecebimentoDiretoBankplusAR([...recebimentosDiretoBankplusAR.values()]);
    }

    // DTZ-273: por último, depois da limpeza da reversão, porque a conta de origem é
    // resolvida a partir do grafo de compensação e precisa enxergá-lo no estado final.
    metrics.contaOrigemResolvida = await this.resolverContaOrigem();

    const timeEnd = performance.now();

    const msg = `[SyncRegistrosContabeisService] Sincronização de registros contábeis concluída. \n` +
      `Tempo de execução: ${formatMillisecondsToHHMMSS(timeEnd - timeStart)}. \n` +
      `Páginas processadas: ${paginas} (top=${top}, total-itens=${totalItens}). \n` +
      `Total recebidos: ${metrics.totalReceived}. \n` +
      `Total inseridos: ${metrics.inserted}. \n` +
      `Total atualizados: ${metrics.updated}. \n` +
      `Total atualizados status_para_envio = null (xtpg) : ${metrics.updatedStatusXtpg}. \n` +
      `Total ignorados (duplicados): ${metrics.ignored}. \n` +
      `Total inválidos: ${metrics.invalid}. \n` +
      `Total revertidos limpos p/ reenvio: ${metrics.revertedCleared}. \n` +
      `Total contas contábeis criadas automaticamente: ${metrics.contasCriadas}. \n` +
      `Total linhas com conta de origem resolvida: ${metrics.contaOrigemResolvida}.`;
    log.info(msg);
    const createSpan = apm.startSpan("SyncRegistrosContabeisService - Sincronização de registros contábeis");
    createSpan?.addLabels({ log: msg });
    createSpan?.end();
    return metrics;
  }

  /**
   * Processa uma página (fatia paginada) do SAP: normaliza, deduplica em memória, quebra em
   * chunks e faz o upsert. Acumula em `reversalDocs`/`novasContas` os itens NOVOS (toCreate)
   * para o pós-processamento único do run (DTZ-245 e DTZ-249). Extraído do laço de chunks
   * original para permitir a paginação in-run sem duplicar a lógica de upsert. Duplicados
   * entre páginas são tratados pelo findMany/unique constraint (caem em toUpdate).
   */
  private async processarPagina(
    items: SapJournalEntryItem[],
    metrics: SyncMetrics,
    reversalDocs: Map<string, { CompanyCode: string; AccountingDocument: string }>,
    novasContas: Map<string, NovaContaContabil>,
    faturasBaixaDiretaBankplus: Map<string, AccountingDocumentItemKey>,
    recebimentosDiretoBankplusAR: Map<string, RecebimentoDiretoBankplusARRef>,
  ): Promise<void> {
    const normalizedItems: AccountingDocumentItemNormalized[] = [];

    for (const item of items) {
      const normalized = this.normalizeItem(item);
      if (!normalized) {
        metrics.invalid += 1;
        continue;
      }
      normalizedItems.push(normalized);
    }

    if (!normalizedItems.length) {
      return;
    }

    const uniqueItems = this.dedupeItems(normalizedItems, metrics);
    if (!uniqueItems.length) {
      return;
    }

    const chunks = this.chunkArray(uniqueItems, CHUNK_SIZE);

    for (const chunk of chunks) {
      const existing = await s4DotzClient.accountingDocumentItem.findMany({
        where: {
          OR: chunk.map((item) => ({
            CompanyCode: item.CompanyCode,
            FiscalYear: item.FiscalYear,
            AccountingDocument: item.AccountingDocument,
            AccountingDocumentItem: item.AccountingDocumentItem,
          })),
        },
        select: {
          CompanyCode: true,
          FiscalYear: true,
          AccountingDocument: true,
          AccountingDocumentItem: true,
          NetDueDate: true,
          DocumentReferenceID: true,
          AmountInCompanyCodeCurrency: true,
          WithholdingTaxAmount: true,
          CashDiscountAmtInCoCodeCrcy: true,
          PaymentMethod: true,
          AccountingDocumentHeaderText: true,
          DocumentItemText: true,
          LastChangeDate: true,
          ClearingAccountingDocument: true,
          ReverseDocument: true,
          IsReversed: true,
          ClearingIsReversed: true,
          ClearingDate: true,
          ReverseDocumentFiscalYear: true,
          ClearingDocFiscalYear: true,
          ClearingItem: true,
        },
      });

      const mapRef = new Map<string, UpdateDiffFieldValues>(
        existing.map((item: AccountingDocumentItemKey & UpdateDiffFieldValues) => [
          this.buildCompositeKey(item),
          this.pickUpdateDiffFields(item),
        ]),
      );

      const toCreate = chunk.filter((item) => !mapRef.has(this.buildCompositeKey(item)));
      const toUpdate = chunk.filter((item) => mapRef.has(this.buildCompositeKey(item)));

      // DTZ-245: registra os docs de reversão recém-inseridos (IsReversal='X') p/ limpeza.
      for (const item of toCreate) {
        if (item.IsReversal === "X") {
          reversalDocs.set(`${item.CompanyCode}|${item.AccountingDocument}`, {
            CompanyCode: item.CompanyCode,
            AccountingDocument: item.AccountingDocument,
          });

          // DTZ-284: a fatura aponta para o documento REVERTIDO (o pagamento), nunca para o
          // documento de reversão. Limpando só pelo número da própria reversão, a fatura
          // ficava presa em SUCESSO_* com o vínculo de compensação intacto e o previsto
          // jamais reabria — era o caso da baixa parcial cancelada (1800000091/1400000054).
          const revertido = item.ReverseDocument?.trim();
          if (revertido) {
            reversalDocs.set(`${item.CompanyCode}|${revertido}`, {
              CompanyCode: item.CompanyCode,
              AccountingDocument: revertido,
            });
          }
        }

        // DTZ-318: na chegada de um pagamento BankPlus de baixa direta (pk 21, K/D, sem
        // clearing), coleta a fatura que ele quita (decodificada da assignment_reference) para
        // reset de status ao fim do run. Sem doc de compensacao o S/4 nao marca a fatura como
        // liquidada, entao o previsto so vai a zero se ela reentrar na view.
        const faturaBaixada = this.faturaDaBaixaDiretaBankplus(item);
        if (faturaBaixada) {
          faturasBaixaDiretaBankplus.set(
            `${faturaBaixada.CompanyCode}|${faturaBaixada.FiscalYear}|${faturaBaixada.AccountingDocument}|${faturaBaixada.AccountingDocumentItem}`,
            faturaBaixada,
          );
        }

        // DTZ-318 AR: na chegada de um recebimento AR BankPlus de baixa direta (pk 11/15, D, sem
        // clearing), coleta o document_reference_id (boleto) para casar a fatura por
        // payment_reference no reset ao fim do run.
        const recebimentoAR = this.refRecebimentoDiretoBankplusAR(item);
        if (recebimentoAR) {
          recebimentosDiretoBankplusAR.set(
            `${recebimentoAR.CompanyCode}|${recebimentoAR.DocumentReferenceID}`,
            recebimentoAR,
          );
        }

        // DTZ-249: coleta a conta contábil do registro novo (precisa da PK completa
        // chart+company+gl). A gravação em contas_contabeis, se ainda não existir, é feita
        // após percorrer todas as páginas.
        const chartOfAccounts = item.ChartOfAccounts?.trim();
        const glAccount = item.GLAccount?.trim();
        if (chartOfAccounts && glAccount) {
          const key = `${chartOfAccounts}|${item.CompanyCode}|${glAccount}`;
          if (!novasContas.has(key)) {
            novasContas.set(key, {
              ChartOfAccounts: chartOfAccounts,
              CompanyCode: item.CompanyCode,
              GLAccount: glAccount,
              GLAccountName: item.GLAccountLongName?.trim() || "",
              GLAccountECD: item.AlternativeGLAccount?.trim() || null,
            });
          }
        }
      }

      if (toCreate.length) {
        try {
          const result = await s4DotzClient.accountingDocumentItem.createMany({
            data: toCreate,
          });
          metrics.inserted += result.count ?? 0;
        } catch (error) {
          if (!this.isUniqueConstraintError(error)) {
            throw error;
          }

          log.warn(
            `[SyncRegistrosContabeisService] Conflito de unicidade detectado. ` +
              `Chunk=${chunk.length} ToCreate=${toCreate.length}`,
          );

          const fallbackResult = await this.createManyWithFallback(toCreate);
          metrics.inserted += fallbackResult.inserted;
          metrics.ignored += fallbackResult.ignored;
        }
      }

      if (toUpdate.length) {
        log.info(`[SyncRegistrosContabeisService] Atualizando ${toUpdate.length} registros no banco`);
        const updateResults = await s4DotzClient.$transaction(
          toUpdate.map((item) => {
            const { CompanyCode, FiscalYear, AccountingDocument, AccountingDocumentItem, ...rest } = item;
            const data = this.removerStickyVazio(rest);
            const dataRef = mapRef.get(this.buildCompositeKey(item)) as UpdateDiffFieldValues;

            let dataUp;
            if (this.hasUpdateDiff(dataRef, item)) {
              dataUp = { ...data, StatusParaEnvio : null };
              metrics.updatedStatusXtpg += 1;
            } else {
              dataUp = data;
            }

            return s4DotzClient.accountingDocumentItem.updateMany({
              where: {
                CompanyCode,
                FiscalYear,
                AccountingDocument,
                AccountingDocumentItem
              },
              data: dataUp,
            });
          }),
        );
        const updatedCount = updateResults.reduce(
          (total: number, result: { count: number }) => total + result.count,
          0,
        );
        metrics.updated += updatedCount;
        log.info(`[SyncRegistrosContabeisService] ${updatedCount} registros atualizados no banco`);
      }
    }
  }

  /**
   * (DTZ-273) Monta o trio sticky_clear_* a partir da compensacao recebida. Os tres campos
   * sao UMA referencia so: ou vem completa, ou nao vem. Devolver so parte dela deixaria o
   * documento gravado com ano/item de outra compensacao, e a referencia nao fecha.
   *
   * O S/4 sinaliza vazio de duas formas — string vazia no documento e "0" nos campos
   * numericos (mesmo padrao de InvoiceReferenceFiscalYear). As duas contam como ausencia.
   */
  private buildStickyClear(item: SapJournalEntryItem): Partial<AccountingDocumentItemNormalized> {
    const accDoc = this.normalizeSapRef(item.ClearingAccountingDocument);
    if (!accDoc) {
      return {};
    }

    return {
      StickyClearAccDoc: accDoc,
      StickyClearDocFiscalYear: this.normalizeSapRef(item.ClearingDocFiscalYear),
      StickyClearItem: this.normalizeSapRef(item.ClearingItem),
    };
  }

  /** Normaliza referencia do S/4: "" e "0" significam ausencia, nao valor. */
  private normalizeSapRef(value?: string | null): string | null {
    const normalized = this.normalizeOptional(value);
    return normalized === "0" ? null : normalized;
  }

  /**
   * (DTZ-273) Remove os campos sticky_clear_* do update quando a compensacao nao veio, para
   * que o valor ja gravado sobreviva. O S/4 zera clearing_* ao reverter a compensacao e o
   * update grava o payload inteiro; sem isto o vinculo entre pagamento e fatura — a unica
   * pista da conta de resultado de origem — seria apagado da nossa base.
   */
  private removerStickyVazio<T extends Record<string, unknown>>(data: T): T {
    const normalized = { ...data };

    if (normalized.StickyClearAccDoc != null) {
      return normalized;
    }

    for (const field of STICKY_CLEAR_FIELDS) {
      delete normalized[field];
    }

    return normalized;
  }

  private pickUpdateDiffFields(item: UpdateDiffFieldValues): UpdateDiffFieldValues {
    return UPDATE_DIFF_FIELDS.reduce<UpdateDiffFieldValues>((fields, field) => {
      fields[field] = item[field];
      return fields;
    }, {});
  }

  private hasUpdateDiff(dataRef: UpdateDiffFieldValues, item: AccountingDocumentItemNormalized): boolean {
    return UPDATE_DIFF_FIELDS.some((field) => {
      const eq = this.normalizeValueForDiff(dataRef[field], field) !== this.normalizeValueForDiff(item[field], field);
      return eq;
    });
  }

  private normalizeValueForDiff(value: unknown, field: keyof AccountingDocumentItemNormalized): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (DECIMAL_UPDATE_DIFF_FIELDS.has(field)) {
      const numericValue = Number(value);
      return Number.isNaN(numericValue) ? String(value) : numericValue;
    }

    return String(value);
  }

  /**
   * (DTZ-245) Limpeza dos registros revertidos, disparada na CHEGADA de uma reversão
   * (documento com IsReversal='X' recém-inserido neste sync). Para cada documento de
   * reversão D, zera status_para_envio e os campos de compensação das linhas cuja
   * clearing_accounting_document = D — a "família de compensação" (reversão + original
   * revertido). Assim os fluxos PREVISTO/REALIZADO reprocessam e reenviam os movimentos; o
   * snapshot congelado p_* da view XRT_SendFlux cobre os clearing_* agora vazios (ver
   * resolveSavFields). Idempotente: só dispara na chegada (não a cada sync), evitando loop de
   * reenvio quando o SAP repopula os clearing_* na próxima sincronização.
   */
  /**
   * (DTZ-273) Resolve a conta de resultado de origem das linhas de parceiro e grava em
   * xtpg_conta_origem. Uma falha aqui nao invalida o sync: a view cai no comportamento
   * anterior (fn_RetornaContraPartida) enquanto a coluna estiver desatualizada.
   */
  private async resolverContaOrigem(): Promise<number> {
    try {
      const affected = await s4DotzClient.$executeRawUnsafe(SQL_RESOLVE_CONTA_ORIGEM_XTPG);
      const count = Number(affected) || 0;
      log.info(`[SyncRegistrosContabeisService] Conta de origem resolvida em ${count} registro(s)`);
      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[SyncRegistrosContabeisService] Falha ao resolver a conta de origem: ${message}`);
      return 0;
    }
  }

  /**
   * (DTZ-318) Identifica um pagamento BankPlus de BAIXA DIRETA (sem doc de compensacao) e
   * devolve a PK da fatura que ele quita. A baixa direta se reconhece por: usuario BANKPLUS,
   * posting_key 21, linha de parceiro (K/D) e clearing_accounting_document ausente. O vinculo
   * com a fatura vem da assignment_reference no layout {ano(4)}{documento(10)}{item(3)} - o
   * mesmo decodificado pelas views XRT_SendFlux (ramo 26) / XRT_SendPrevPagto. Retorna null
   * quando nao e esse caso ou a referencia nao decodifica.
   */
  private faturaDaBaixaDiretaBankplus(
    item: AccountingDocumentItemNormalized,
  ): AccountingDocumentItemKey | null {
    if (item.AccountingDocCreatedByUser !== "BANKPLUS") return null;
    if (item.PostingKey !== "21") return null;
    if (item.FinancialAccountType !== "K" && item.FinancialAccountType !== "D") return null;
    const clearing = this.normalizeSapRef(item.ClearingAccountingDocument);
    if (clearing) return null; // so baixa direta: clearing ausente

    const asg = item.AssignmentReference?.trim();
    if (!asg || asg.length < 17) return null;

    const fiscalYear = asg.slice(0, 4);
    const accountingDocument = asg.slice(4, 14).trim();
    const itemNumber = Number(asg.slice(14, 17));
    if (!/^\d{4}$/.test(fiscalYear) || !accountingDocument || Number.isNaN(itemNumber)) return null;

    return {
      CompanyCode: item.CompanyCode,
      FiscalYear: fiscalYear,
      AccountingDocument: accountingDocument,
      AccountingDocumentItem: String(itemNumber),
    };
  }

  /**
   * (DTZ-318) Reseta status_para_envio das faturas baixadas por baixa direta BankPlus, para
   * reentrarem no previsto e irem a zero (bloco 'Prev liquidados Bank Direto'). So toca a linha
   * que ainda esta em SUCESSO_PREV: assim o previsto reemite 0 e, no ciclo seguinte, o realizado
   * (ramo 26) emite o valor da baixa. Idempotente: dispara so na chegada do pagamento (toCreate).
   */
  private async resetarFaturasBaixaDiretaBankplus(
    faturas: AccountingDocumentItemKey[],
  ): Promise<number> {
    let resetadas = 0;
    for (const f of faturas) {
      try {
        const affected = await s4DotzClient.$executeRawUnsafe(
          `UPDATE s4_extensao_dotz.dbo.registros_contabeis
           SET status_para_envio = NULL
           WHERE company_code = @P1 AND fiscal_year = @P2 AND accounting_document = @P3
             AND accounting_document_item = @P4 AND status_para_envio = 'SUCESSO_PREV'`,
          f.CompanyCode,
          f.FiscalYear,
          f.AccountingDocument,
          f.AccountingDocumentItem,
        );
        const count = Number(affected) || 0;
        resetadas += count;
        if (count) {
          log.info(
            `[SyncRegistrosContabeisService] Baixa direta BankPlus: fatura ${f.CompanyCode}/${f.AccountingDocument}/${f.AccountingDocumentItem} resetada p/ zerar o previsto`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[SyncRegistrosContabeisService] Falha ao resetar fatura de baixa direta BankPlus ${f.CompanyCode}/${f.AccountingDocument}/${f.AccountingDocumentItem}: ${message}`,
        );
      }
    }
    return resetadas;
  }

  /**
   * (DTZ-318 AR) Identifica um recebimento de contas a RECEBER via BankPlus de BAIXA DIRETA (sem
   * doc de compensacao) e devolve a referencia (boleto) para casar a fatura. Reconhece por:
   * usuario BANKPLUS, posting_key 11/15 (linha do cliente do retorno bancario), tipo D e
   * clearing_accounting_document ausente. O vinculo com a fatura AR vem do document_reference_id
   * (boleto) = payment_reference da fatura - diferente do AP, cujo assignment_reference encoda
   * ano+doc+item. Retorna null quando nao e esse caso ou a referencia esta vazia.
   */
  private refRecebimentoDiretoBankplusAR(
    item: AccountingDocumentItemNormalized,
  ): RecebimentoDiretoBankplusARRef | null {
    if (item.AccountingDocCreatedByUser !== "BANKPLUS") return null;
    if (item.PostingKey !== "11" && item.PostingKey !== "15") return null;
    if (item.FinancialAccountType !== "D") return null;
    if (this.normalizeSapRef(item.ClearingAccountingDocument)) return null; // so baixa direta
    const ref = item.DocumentReferenceID?.trim();
    if (!ref) return null;
    return { CompanyCode: item.CompanyCode, DocumentReferenceID: ref };
  }

  /**
   * (DTZ-318 AR) Reseta status_para_envio das faturas AR baixadas por recebimento direto BankPlus,
   * casadas por payment_reference = document_reference_id do recebimento, para reentrarem no
   * previsto e irem a zero (bloco 'Prev liquidados AR Bank Direto'). So toca a linha AR (pk 01/06,
   * nao BankPlus) ainda em SUCESSO_PREV, aberta (clearing/reverse nulos): o previsto reemite 0 e,
   * no ciclo seguinte, o realizado (ramo 27) emite a entrada. Idempotente: dispara so na chegada
   * do recebimento (toCreate).
   */
  private async resetarFaturasRecebimentoDiretoBankplusAR(
    recebimentos: RecebimentoDiretoBankplusARRef[],
  ): Promise<number> {
    let resetadas = 0;
    for (const r of recebimentos) {
      try {
        const affected = await s4DotzClient.$executeRawUnsafe(
          `UPDATE s4_extensao_dotz.dbo.registros_contabeis
           SET status_para_envio = NULL
           WHERE company_code = @P1 AND payment_reference = @P2
             AND financial_account_type = 'D' AND posting_key IN ('01','06')
             AND accounting_doc_created_by_user <> 'BANKPLUS'
             AND clearing_accounting_document IS NULL AND reverse_document IS NULL
             AND status_para_envio = 'SUCESSO_PREV'`,
          r.CompanyCode,
          r.DocumentReferenceID,
        );
        const count = Number(affected) || 0;
        resetadas += count;
        if (count) {
          log.info(
            `[SyncRegistrosContabeisService] Recebimento direto BankPlus AR: fatura(s) do boleto ${r.CompanyCode}/${r.DocumentReferenceID} resetada(s) p/ zerar o previsto`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[SyncRegistrosContabeisService] Falha ao resetar fatura AR de recebimento direto BankPlus ${r.CompanyCode}/${r.DocumentReferenceID}: ${message}`,
        );
      }
    }
    return resetadas;
  }

  private async limparFilhosRevertidos(
    reversalDocs: Array<{ CompanyCode: string; AccountingDocument: string }>,
  ): Promise<number> {
    let cleared = 0;
    for (const { CompanyCode, AccountingDocument } of reversalDocs) {
      try {
        const affected = await s4DotzClient.$executeRawUnsafe(
          `UPDATE s4_extensao_dotz.dbo.registros_contabeis
           SET status_para_envio = NULL,
               clearing_accounting_document = NULL,
               clearing_doc_fiscal_year = NULL,
               clearing_item = NULL,
               clearing_date = NULL,
               clearing_is_reversed = NULL
           WHERE company_code = @P1 AND clearing_accounting_document = @P2`,
          CompanyCode,
          AccountingDocument,
        );
        const count = Number(affected) || 0;
        cleared += count;
        log.info(
          `[SyncRegistrosContabeisService] Reversão ${CompanyCode}/${AccountingDocument}: ${count} registro(s) limpo(s) p/ reenvio`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[SyncRegistrosContabeisService] Falha ao limpar filhos da reversão ${CompanyCode}/${AccountingDocument}: ${message}`,
        );
      }
    }
    return cleared;
  }

  /**
   * (DTZ-249) Ao chegar um registro contábil novo, se a conta (chart+company+gl) ainda não
   * existir em `contas_contabeis`, grava a linha automaticamente (não há tela de plano de
   * contas). Campos herdados do registro: gl_account_name <- gl_account_long_name;
   * gl_account_ecd <- alternative_gl_account. Demais ficam vazios; data_alteracao = hoje;
   * xtpg_ativado = false (a conta nasce inativa/sem item de fluxo e só é enviada ao XTPG
   * depois de classificada – ver DTZ-248 e o gate das views). Idempotente: consulta as
   * existentes e insere só as faltantes; tolera conflito de unicidade (corrida).
   */
  private async autoCriarContasContabeis(contas: NovaContaContabil[]): Promise<number> {
    if (!contas.length) {
      return 0;
    }

    const existentes = await s4DotzClient.contasContabeis.findMany({
      where: {
        OR: contas.map((c) => ({
          ChartOfAccounts: c.ChartOfAccounts,
          CompanyCode: c.CompanyCode,
          GLAccount: c.GLAccount,
        })),
      },
      select: { ChartOfAccounts: true, CompanyCode: true, GLAccount: true },
    });

    const existentesKeys = new Set(
      existentes.map(
        (c: { ChartOfAccounts: string; CompanyCode: string; GLAccount: string }) =>
          `${c.ChartOfAccounts}|${c.CompanyCode}|${c.GLAccount}`,
      ),
    );

    const faltantes = contas.filter(
      (c) => !existentesKeys.has(`${c.ChartOfAccounts}|${c.CompanyCode}|${c.GLAccount}`),
    );

    if (!faltantes.length) {
      return 0;
    }

    const now = new Date();
    const rows = faltantes.map((c) => ({
      ChartOfAccounts: c.ChartOfAccounts,
      CompanyCode: c.CompanyCode,
      GLAccount: c.GLAccount,
      GLAccountName: c.GLAccountName,
      ...(c.GLAccountECD ? { GLAccountECD: c.GLAccountECD } : {}),
      XtpgAtivado: false,
      DataAlteracao: now,
    }));

    try {
      const result = await s4DotzClient.contasContabeis.createMany({ data: rows });
      const created = result.count ?? 0;
      log.info(
        `[SyncRegistrosContabeisService] Contas contábeis criadas automaticamente: ${created}`,
      );
      return created;
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[SyncRegistrosContabeisService] Falha ao criar contas contábeis automaticamente: ${message}`,
        );
        return 0;
      }

      // Corrida: alguma conta foi criada entre a consulta e o insert. Grava uma a uma,
      // ignorando as que já existirem.
      let created = 0;
      for (const row of rows) {
        try {
          await s4DotzClient.contasContabeis.create({ data: row });
          created += 1;
        } catch (innerError) {
          if (!this.isUniqueConstraintError(innerError)) {
            const message = innerError instanceof Error ? innerError.message : String(innerError);
            log.error(
              `[SyncRegistrosContabeisService] Falha ao criar conta contábil ` +
                `${row.ChartOfAccounts}/${row.CompanyCode}/${row.GLAccount}: ${message}`,
            );
          }
        }
      }
      log.info(
        `[SyncRegistrosContabeisService] Contas contábeis criadas automaticamente (fallback): ${created}`,
      );
      return created;
    }
  }

  private buildFilterDate(): string {
    const dateString = format(new Date(), "yyyy-MM-dd");
    const dateAtMidnightUTC = parseDateForFilter(dateString);
    return dateAtMidnightUTC.toISOString().split(".")[0];
  }

  private normalizeItem(item: SapJournalEntryItem): AccountingDocumentItemNormalized | null {
    const CompanyCode = this.normalizeRequired(item.CompanyCode);
    if (!CompanyCode) {
      return null;
    }

    const FiscalYear = this.normalizeRequired(item.FiscalYear);
    if (!FiscalYear) {
      return null;
    }

    const AccountingDocument = this.normalizeRequired(item.AccountingDocument);
    if (!AccountingDocument) {
      return null;
    }

    const AccountingDocumentItem = this.normalizeRequired(item.AccountingDocumentItem);
    if (!AccountingDocumentItem) {
      return null;
    }

    return this.applyMaxLengths({
      CompanyCode,
      FiscalYear,
      AccountingDocument,
      AccountingDocumentItem,
      ChartOfAccounts: this.normalizeOptional(item.ChartOfAccounts),
      AccountingDocumentItemType: this.normalizeOptional(item.AccountingDocumentItemType),
      ClearingDate: this.parseSapDate(item.ClearingDate),
      ClearingCreationDate: this.parseSapDate(item.ClearingCreationDate),
      ClearingAccountingDocument: this.normalizeOptional(item.ClearingAccountingDocument),
      ...this.buildStickyClear(item),
      IsCleared: this.normalizeSapBoolean(item.IsCleared),
      PostingKey: this.normalizeOptional(item.PostingKey),
      FinancialAccountType: this.normalizeOptional(item.FinancialAccountType),
      DebitCreditCode: this.normalizeOptional(item.DebitCreditCode),
      BusinessArea: this.normalizeOptional(item.BusinessArea),
      PartnerBusinessArea: this.normalizeOptional(item.PartnerBusinessArea),
      TaxCode: this.normalizeOptional(item.TaxCode),
      WithholdingTaxCode: this.normalizeOptional(item.WithholdingTaxCode),
      TaxType: this.normalizeOptional(item.TaxType),
      TransactionTypeDetermination: this.normalizeOptional(item.TransactionTypeDetermination),
      ValueDate: this.parseSapDate(item.ValueDate),
      AssignmentReference: this.normalizeOptional(item.AssignmentReference),
      DocumentItemText: this.normalizeOptional(item.DocumentItemText),
      ControllingArea: this.normalizeOptional(item.ControllingArea),
      CostCenter: this.normalizeOptional(item.CostCenter),
      Project: this.normalizeOptional(item.Project),
      OrderID: this.normalizeOptional(item.OrderID),
      BillingDocument: this.normalizeOptional(item.BillingDocument),
      SalesDocument: this.normalizeOptional(item.SalesDocument),
      SalesDocumentItem: this.normalizeOptional(item.SalesDocumentItem),
      FixedAsset: this.normalizeOptional(item.FixedAsset),
      AssetTransactionType: this.normalizeOptional(item.AssetTransactionType),
      OperationalGLAccount: this.normalizeOptional(item.OperationalGLAccount),
      GLAccount: this.normalizeOptional(item.GLAccount),
      Customer: this.normalizeOptional(item.Customer),
      Supplier: this.normalizeOptional(item.Supplier),
      ProfitLossAccountType: this.normalizeOptional(item.ProfitLossAccountType),
      DueCalculationBaseDate: this.parseSapDate(item.DueCalculationBaseDate),
      PaymentTerms: this.normalizeOptional(item.PaymentTerms),
      CashDiscount1Days: this.normalizeOptional(item.CashDiscount1Days),
      CashDiscount2Days: this.normalizeOptional(item.CashDiscount2Days),
      NetPaymentDays: this.normalizeOptional(item.NetPaymentDays),
      CashDiscount1Percent: this.normalizeOptional(item.CashDiscount1Percent),
      CashDiscount2Percent: this.normalizeOptional(item.CashDiscount2Percent),
      PaymentReason: this.normalizeOptional(item.PaymentReason),
      PaymentMethod: this.normalizeOptional(item.PaymentMethod),
      PaymentBlockingReason: this.normalizeOptional(item.PaymentBlockingReason),
      HouseBank: this.normalizeOptional(item.HouseBank),
      BPBankAccountInternalID: this.normalizeOptional(item.BPBankAccountInternalID),
      InvoiceReference: this.normalizeOptional(item.InvoiceReference),
      InvoiceReferenceFiscalYear: this.normalizeOptional(item.InvoiceReferenceFiscalYear),
      InvoiceItemReference: this.normalizeOptional(item.InvoiceItemReference),
      Plant: this.normalizeOptional(item.Plant),
      PurchasingDocument: this.normalizeOptional(item.PurchasingDocument),
      ProfitCenter: this.normalizeOptional(item.ProfitCenter),
      ClearingIsReversed: this.normalizeSapBoolean(item.ClearingIsReversed),
      AlternativeGLAccount: this.normalizeOptional(item.AlternativeGLAccount),
      PaymentReference: this.normalizeOptional(item.PaymentReference),
      ClearingItem: this.normalizeOptional(item.ClearingItem),
      BusinessPlace: this.normalizeOptional(item.BusinessPlace),
      FunctionalArea: this.normalizeOptional(item.FunctionalArea),
      ClearingDocFiscalYear: this.normalizeOptional(item.ClearingDocFiscalYear),
      HouseBankAccount: this.normalizeOptional(item.HouseBankAccount),
      ReferenceDocumentType: this.normalizeOptional(item.ReferenceDocumentType),
      OriginalReferenceDocument: this.normalizeOptional(item.OriginalReferenceDocument),
      FiscalPeriod: this.normalizeOptional(item.FiscalPeriod),
      PostingDate: this.parseSapDate(item.PostingDate),
      DocumentDate: this.parseSapDate(item.DocumentDate),
      AccountingDocumentType: this.normalizeOptional(item.AccountingDocumentType),
      NetDueDate: this.parseSapDate(item.NetDueDate),
      CashDiscount1DueDate: this.parseSapDate(item.CashDiscount1DueDate),
      CashDiscount2DueDate: this.parseSapDate(item.CashDiscount2DueDate),
      CompanyCodeCurrency: this.normalizeOptional(item.CompanyCodeCurrency),
      AmountInCompanyCodeCurrency: this.normalizeOptional(item.AmountInCompanyCodeCurrency),
      TaxAmountInCoCodeCrcy: this.normalizeOptional(item.TaxAmountInCoCodeCrcy),
      TaxBaseAmountInCoCodeCrcy: this.normalizeOptional(item.TaxBaseAmountInCoCodeCrcy),
      ValuationDiffAmtInCoCodeCrcy: this.normalizeOptional(item.ValuationDiffAmtInCoCodeCrcy),
      CashDiscountAmtInCoCodeCrcy: this.normalizeOptional(item.CashDiscountAmtInCoCodeCrcy),
      InvoiceAmtInCoCodeCrcy: this.normalizeOptional(item.InvoiceAmtInCoCodeCrcy),
      TransactionCurrency: this.normalizeOptional(item.TransactionCurrency),
      AmountInTransactionCurrency: this.normalizeOptional(item.AmountInTransactionCurrency),
      OriginalTaxBaseAmount: this.normalizeOptional(item.OriginalTaxBaseAmount),
      TaxAmount: this.normalizeOptional(item.TaxAmount),
      TaxBaseAmountInTransCrcy: this.normalizeOptional(item.TaxBaseAmountInTransCrcy),
      WithholdingTaxBaseAmount: this.normalizeOptional(item.WithholdingTaxBaseAmount),
      PlannedAmtInTransactionCrcy: this.normalizeOptional(item.PlannedAmtInTransactionCrcy),
      CashDiscountBaseAmount: this.normalizeOptional(item.CashDiscountBaseAmount),
      CashDiscountAmount: this.normalizeOptional(item.CashDiscountAmount),
      NetPaymentAmount: this.normalizeOptional(item.NetPaymentAmount),
      WithholdingTaxAmount: this.normalizeOptional(item.WithholdingTaxAmount),
      WithholdingTaxExemptionAmt: this.normalizeOptional(item.WithholdingTaxExemptionAmt),
      InvoiceAmountInFrgnCurrency: this.normalizeOptional(item.InvoiceAmountInFrgnCurrency),
      BalanceTransactionCurrency: this.normalizeOptional(item.BalanceTransactionCurrency),
      AmountInBalanceTransacCrcy: this.normalizeOptional(item.AmountInBalanceTransacCrcy),
      AdditionalCurrency1: this.normalizeOptional(item.AdditionalCurrency1),
      ValuationDiffAmtInAddlCrcy1: this.normalizeOptional(item.ValuationDiffAmtInAddlCrcy1),
      AmountInAdditionalCurrency1: this.normalizeOptional(item.AmountInAdditionalCurrency1),
      Quantity: this.normalizeOptional(item.Quantity),
      AccountingDocumentCreationDate: this.parseSapDate(item.AccountingDocumentCreationDate),
      CreationTime: this.normalizeOptional(item.CreationTime),
      LastChangeDate: this.parseSapDate(item.LastChangeDate),
      AccountingDocCreatedByUser: this.normalizeOptional(item.AccountingDocCreatedByUser),
      DocumentReferenceID: this.normalizeOptional(item.DocumentReferenceID),
      ReverseDocument: this.normalizeOptional(item.ReverseDocument),
      ReverseDocumentFiscalYear: this.normalizeOptional(item.ReverseDocumentFiscalYear),
      AccountingDocumentHeaderText: this.normalizeOptional(item.AccountingDocumentHeaderText),
      ReversalReason: this.normalizeOptional(item.ReversalReason),
      TaxReportingDate: this.parseSapDate(item.TaxReportingDate),
      IsReversal: this.normalizeSapBoolean(item.IsReversal),
      IsReversed: this.normalizeSapBoolean(item.IsReversed),
      BusinessTransactionType: this.normalizeOptional(item.BusinessTransactionType),
      CompanyCodeName: this.normalizeOptional(item.CompanyCodeName),
      BusinessAreaName: this.normalizeOptional(item.BusinessAreaName),
      ControllingAreaName: this.normalizeOptional(item.ControllingAreaName),
      CostCenterName: this.normalizeOptional(item.CostCenterName),
      FunctionalAreaName: this.normalizeOptional(item.FunctionalAreaName),
      AccountingDocumentCategoryName: this.normalizeOptional(item.AccountingDocumentCategoryName),
      AccountingDocumentTypeName: this.normalizeOptional(item.AccountingDocumentTypeName),
      SegmentName: this.normalizeOptional(item.SegmentName),
      ProfitCenterName: this.normalizeOptional(item.ProfitCenterName),
      GLAccountLongName: this.normalizeOptional(item.GLAccountLongName),
      Reference1IDByBusinessPartner: this.normalizeOptional(item.Reference1IDByBusinessPartner),
      Reference2IDByBusinessPartner: this.normalizeOptional(item.Reference2IDByBusinessPartner),
      Reference3IDByBusinessPartner: this.normalizeOptional(item.Reference3IDByBusinessPartner),
    });
  }

  private normalizeRequired(value?: string | null): string | null {
    const normalized = this.normalizeOptional(value);
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private normalizeOptional(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.toString().trim();
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private normalizeSapBoolean(value?: boolean | string | null): string | null {
    if (value === true || value === "X" || value === "true") {
      return "X";
    }
    return null;
  }

  private parseSapDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const match = /Date\((\d+)\)/.exec(value);
    if (match) {
      const timestamp = Number(match[1]);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private async createManyWithFallback(
    items: AccountingDocumentItemNormalized[],
  ): Promise<{ inserted: number; ignored: number }> {
    let inserted = 0;
    let ignored = 0;

    for (const item of items) {
      const existing = await s4DotzClient.accountingDocumentItem.findFirst({
        where: {
          CompanyCode: item.CompanyCode,
          FiscalYear: item.FiscalYear,
          AccountingDocument: item.AccountingDocument,
          AccountingDocumentItem: item.AccountingDocumentItem,
        },
        select: {
          CompanyCode: true,
          FiscalYear: true,
          AccountingDocument: true,
          AccountingDocumentItem: true,
        },
      });

      if (existing) {
        ignored += 1;
        log.warn(
          `[SyncRegistrosContabeisService] Registro ignorado por duplicidade: ${this.buildCompositeKey(item)}`,
        );
        continue;
      }

      try {
        await s4DotzClient.accountingDocumentItem.create({
          data: item,
        });
        inserted += 1;
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          ignored += 1;
          log.warn(
            `[SyncRegistrosContabeisService] Registro ignorado por duplicidade: ${this.buildCompositeKey(item)}`,
          );
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        log.error(`[SyncRegistrosContabeisService] Falha ao inserir registro: ${message}`);
        throw error;
      }
    }

    return { inserted, ignored };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const maybeError = error as { code?: string; message?: string };
    if (maybeError.code === "P2002") {
      return true;
    }

    if (maybeError.message?.includes("Unique constraint failed")) {
      return true;
    }

    return false;
  }

  private applyMaxLengths(
    item: AccountingDocumentItemNormalized,
  ): AccountingDocumentItemNormalized {
    const recordKey = this.buildCompositeKey(item);
    const normalized = { ...item };

    for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
      const value = (normalized as Record<string, unknown>)[field];
      if (typeof value !== "string") {
        continue;
      }

      if (value.length <= maxLength) {
        continue;
      }

      log.warn(
        `[SyncRegistrosContabeisService] Valor maior que o permitido. Campo=${field} ` +
          `Max=${maxLength} Atual=${value.length} Registro=${recordKey} Valor=${value}`,
      );

      (normalized as Record<string, unknown>)[field] = value.slice(0, maxLength);
    }

    return normalized;
  }

  private dedupeItems(
    items: AccountingDocumentItemNormalized[],
    metrics: SyncMetrics,
  ): AccountingDocumentItemNormalized[] {
    const uniqueMap = new Map<string, AccountingDocumentItemNormalized>();

    for (const item of items) {
      const key = this.buildCompositeKey(item);
      if (uniqueMap.has(key)) {
        metrics.ignored += 1;
        continue;
      }
      uniqueMap.set(key, item);
    }

    return Array.from(uniqueMap.values());
  }

  private buildCompositeKey(item: {
    CompanyCode: string;
    FiscalYear: string;
    AccountingDocument: string;
    AccountingDocumentItem: string;
  }): string {
    return `${item.CompanyCode}|${item.FiscalYear}|${item.AccountingDocument}|${item.AccountingDocumentItem}`;
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
