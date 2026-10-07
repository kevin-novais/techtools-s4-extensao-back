import log from "@/util/logger";
import apm from "@/apm";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { VexpensesApi } from "@/cron/modules/vexpenses/http/VexpensesApi";
import { CiaVexpenseRepository } from "@/cron/modules/vexpenses/repositories/CiaVexpenseRepository";
import { ConfiguracaoContabilVexpenseRepository } from "@/cron/modules/vexpenses/repositories/ConfiguracaoContabilVexpenseRepository";
import {
  VexpensesApprovedReportsResult,
  VexpensesGroupedExpense,
  VexpensesGroupedExpensesByCardCodeAndCompany,
  VexpensesIntegrationJson,
  VexpensesIntegrationLancamento,
  VexpensesReportExpense,
  VexpensesReportStatus,
  VexpensesTeamMember,
} from "@/cron/modules/vexpenses/types/expenses.types";
import {
  chunkArray,
  extractExpenses,
  sumExpenses,
  sumLancamentos,
  toNegative,
} from "@/cron/modules/vexpenses/utils/vexpensesCollectionUtils";
import {
  formatDateYYYYMMDD,
  parseExpenseDate,
  resolveDiasPassados,
  toUtcDate,
} from "@/cron/modules/vexpenses/utils/vexpensesDateUtils";
import { aggregateByReport, buildLancamentos } from "@/cron/modules/vexpenses/utils/vexpensesIntegrationBuilder";
import { Config } from "@/config/config";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";
import { publishVexpensesSAPIntegration } from "@/queue/producers/vexpensesSapIntegrationProducer";
import { addDays, subDays } from "date-fns";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APPROVED_STATUS: VexpensesReportStatus = "APROVADO";
const PROCESSABLE_DB_STATUSES = new Set(["PENDENTE", "ERRO_INTEGRACAO_SAP"]);
const STATUS_DESCARTADO = "DESCARTADO";
const INTEGRATED_STATUSES = new Set(["INTEGRADO_SAP", "INTEGRADO_VEXPENSES"]);
const REPORT_CHUNK_SIZE = 500;
const SEARCH_FIELDS = "approval_date:between;payment_date:>=;created_at:=";
const USUARIO_LANCAMENTO = Config.S4_HANA_CLOUD_USER_NAME;
/** Limite do campo textoDocumento no SAP (= NVarChar(25) do textoHeaderContabil). */
const TEXTO_DOCUMENTO_MAX_LENGTH = 25;

type TeamMemberIntegrationData = {
  cardCode: string | null;
  codigoCia: string | null;
  nome: string | null;
};

export class VexpensesApprovedReportsService {
  private readonly vexpensesApi = new VexpensesApi();
  private readonly integracaoSapService = new IntegracaoSapCreateJournalEntryService();
  private readonly ciaVexpenseRepository = new CiaVexpenseRepository();
  private readonly configContabilVexpenseRepository = new ConfiguracaoContabilVexpenseRepository();

  async execute(
    options: { buildIntegrations?: boolean; sendToSap?: boolean; enqueueIntegrations?: boolean } = {},
  ): Promise<VexpensesApprovedReportsResult> {
    const buildIntegrations = options.buildIntegrations ?? true;
    const sendToSap = options.sendToSap ?? false;
    const enqueueIntegrations = options.enqueueIntegrations ?? true;
    log.info("[VexpensesApprovedReportsService] Iniciando busca de reports aprovados");
    
    // Acumuladores do run inteiro (todas as janelas). Servem só para o retorno final
    // (contagem/log em quem chama `execute`) — o processamento e o envio de cada janela
    // usam sempre as variáveis locais `windowGroupedExpenses`/`windowIntegracoes` abaixo.
    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const integracoes: VexpensesIntegrationJson[] = [];

    // `today` é fixado uma única vez, truncado para meia-noite UTC. Comparar com
    // `new Date()` a cada volta do laço nunca daria "true" (a hora atual é sempre maior
    // que meia-noite) e o laço nunca pararia.
    const today = this.toUtcDate(new Date());
    let end: Date | undefined = undefined; // fim da última janela buscada; undefined = ainda não buscou nenhuma

    // Avança em janelas de data (de `VEXPENSES_DIAS_PASSADOS` em `VEXPENSES_DIAS_PASSADOS`
    // dias) a partir da última aprovação já processada, até alcançar a data de hoje.
    // Sem esse laço, o filtro de busca ficava travado na mesma janela para sempre.
    for (;;) {
      const { search, endDate } = await this.buildApprovalDateSearch(end);
      end = endDate;
      const isLastWindow = end.getTime() >= today.getTime();
      log.info(`[VexpensesApprovedReportsService] Filtro aplicado: ${search}`);

      const reports = await this.vexpensesApi.getReportStatus(APPROVED_STATUS, {
        search,
        searchFields: SEARCH_FIELDS,
      });

      if (!reports.length) {
        log.info("[VexpensesApprovedReportsService] Nenhum report APROVADO encontrado");
        // Janela vazia não é erro: só avança pra próxima, a menos que já tenha alcançado hoje.
        if (isLastWindow) {
          break;
        }
        continue;
      }

      // Escopo por janela: cada iteração do laço de datas processa só os reports
      // encontrados na sua própria janela, evitando reprocessar/reenfileirar reports
      // de janelas anteriores (que continuariam em `groupedExpenses` se fosse acumulado).
      const windowGroupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
      const reportIds = reports.map((report) => report.id);
      const statusByReportId = await this.fetchControleStatusMap(reportIds);
      const approvalDateByReportId = this.buildApprovalDateMap(reports);
      const expenseTypeIntegrationMap = await this.buildExpenseTypeIntegrationMap();
      const teamMemberIntegrationCache = new Map<number, TeamMemberIntegrationData>();
      const costCenterIntegrationCache = new Map<number, string | null>();
      let skippedReports = 0;
      let processedReports = 0;
      let processedExpenses = 0;
      let expensesMissingCardCode = 0;
      let expensesMissingCostCenterIntegration = 0;
      let reportsWithoutExpenses = 0;
      let expensesMissingPayingCompany = 0;
      let expensesMissingAccountingAccount = 0;
      let reportsMissingCodigoCia = 0;
      let sampleSaved = false;

      for (const report of reports) {
        const currentStatus = statusByReportId.get(report.id);
        const result = await this.processReport(
          report.id,
          report.user_id,
          currentStatus,
          windowGroupedExpenses,
          teamMemberIntegrationCache,
          costCenterIntegrationCache,
          expenseTypeIntegrationMap,
          approvalDateByReportId.get(report.id) ?? null,
          sampleSaved,
        );

        skippedReports += result.skippedReports;
        processedReports += result.processedReports;
        processedExpenses += result.processedExpenses;
        expensesMissingCardCode += result.expensesMissingCardCode;
        expensesMissingCostCenterIntegration += result.expensesMissingCostCenterIntegration;
        expensesMissingPayingCompany += result.expensesMissingPayingCompany;
        expensesMissingAccountingAccount += result.expensesMissingAccountingAccount;
        reportsMissingCodigoCia += result.reportsMissingCodigoCia;
        reportsWithoutExpenses += result.reportsWithoutExpenses;
        sampleSaved = result.sampleSaved;
      }

      let windowIntegracoes: VexpensesIntegrationJson[] = [];

      if (buildIntegrations) {
        // Monta a integração usando só o que essa janela agrupou — se usássemos o
        // acumulado geral aqui, relatórios de janelas anteriores seriam remontados e
        // reenfileirados de novo (risco de lançamento duplicado no SAP).
        windowIntegracoes = await this.buildIntegrationJson(windowGroupedExpenses, approvalDateByReportId);
        integracoes.push(...windowIntegracoes);
      }

      if (buildIntegrations && enqueueIntegrations) {
        await this.enqueueIntegrations(windowIntegracoes);
      }

      if (buildIntegrations && sendToSap) {
        await this.sendIntegrationsToSap(windowIntegracoes);
      }

      // Só agora mescla no acumulado geral, para a contagem final — o envio já
      // aconteceu acima usando exclusivamente os dados desta janela.
      Object.assign(groupedExpenses, windowGroupedExpenses);

      const windowSummary =
        `Reports=${reports.length}, Processados=${processedReports}, Ignorados=${skippedReports}, ` +
        `Despesas=${processedExpenses}, SemCardCode=${expensesMissingCardCode}, SemPayingCompany=${expensesMissingPayingCompany}, SemCostCenterIntegration=${expensesMissingCostCenterIntegration}, ` +
        `SemContaContabil=${expensesMissingAccountingAccount}, ReportsSemCodigoCia=${reportsMissingCodigoCia}, ReportsSemDespesas=${reportsWithoutExpenses}, ` +
        `CardCodes=${Object.keys(windowGroupedExpenses).length}, Integracoes=${windowIntegracoes.length}`;

      log.info(`[VexpensesApprovedReportsService] Finalizado. ${windowSummary}`);

      // Span por janela, visível dentro da transação "Vexpenses Approved Reports" no APM
      // (aberta em vexpensesApprovedReportsJob.ts) — permite ver no Kibana quantos reports
      // cada janela de data trouxe, sem precisar ir direto no log.
      const windowSpan = apm.startSpan("VexpensesApprovedReportsService - Janela de aprovação");
      windowSpan?.addLabels({ filtro: search, resumo: windowSummary });
      windowSpan?.end();

      if (isLastWindow) {
        break; // janela já alcançou hoje — não há mais o que buscar
      }
    }

    return { groupedExpenses, integracoes };
  }

  private shouldProcessReport(status?: string): boolean {
    if (!status) {
      return true;
    }

    return PROCESSABLE_DB_STATUSES.has(status);
  }

  private buildApprovalDateMap(
    reports: { id: number; approval_date: string | null }[],
  ): Map<number, Date | null> {
    const approvalDateByReportId = new Map<number, Date | null>();

    for (const report of reports) {
      const approvalDate = report.approval_date ? this.parseExpenseDate(report.approval_date) : null;
      approvalDateByReportId.set(report.id, approvalDate);
    }

    return approvalDateByReportId;
  }

  private async processReport(
    reportId: number,
    reportUserId: number,
    currentStatus: string | undefined,
    groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany,
    teamMemberIntegrationCache: Map<number, TeamMemberIntegrationData>,
    costCenterIntegrationCache: Map<number, string | null>,
    expenseTypeIntegrationMap: Map<number, string>,
    approvalDate: Date | null,
    sampleSaved: boolean,
  ): Promise<{
    skippedReports: number;
    processedReports: number;
    processedExpenses: number;
    expensesMissingCardCode: number;
    expensesMissingCostCenterIntegration: number;
    expensesMissingPayingCompany: number;
    expensesMissingAccountingAccount: number;
    reportsMissingCodigoCia: number;
    reportsWithoutExpenses: number;
    sampleSaved: boolean;
  }> {
    if (!this.shouldProcessReport(currentStatus)) {
      log.warn(
        `[VexpensesApprovedReportsService] Report ${reportId} ignorado. Status atual: ${currentStatus ?? "NAO_ENCONTRADO"}`,
      );
      return {
        skippedReports: 1,
        processedReports: 0,
        processedExpenses: 0,
        expensesMissingCardCode: 0,
        expensesMissingCostCenterIntegration: 0,
        expensesMissingPayingCompany: 0,
        expensesMissingAccountingAccount: 0,
        reportsMissingCodigoCia: 0,
        reportsWithoutExpenses: 0,
        sampleSaved,
      };
    }

    const reportWithExpenses = await this.vexpensesApi.getReportExpenses(reportId);
    const normalizedReport = this.normalizeReportWithExpenses(reportWithExpenses, reportId);

    if (!normalizedReport) {
      await this.saveEmptyReportSample(reportWithExpenses, reportId, sampleSaved);
      await this.registrarReportDescartado(
        reportId,
        "Relatório descartado: payload sem campo 'expenses'",
        { approvalDate },
      );
      return {
        skippedReports: 0,
        processedReports: 1,
        processedExpenses: 0,
        expensesMissingCardCode: 0,
        expensesMissingCostCenterIntegration: 0,
        expensesMissingPayingCompany: 0,
        expensesMissingAccountingAccount: 0,
        reportsMissingCodigoCia: 0,
        reportsWithoutExpenses: 1,
        sampleSaved: true,
      };
    }

    const expenses = this.extractExpenses(normalizedReport.expenses);
    let processedExpenses = 0;
    let expensesMissingCardCode = 0;
    let expensesMissingCostCenterIntegration = 0;
    let reportsWithoutExpenses = 0;
    let expensesMissingPayingCompany = 0;
    let expensesMissingAccountingAccount = 0;
    let reportsMissingCodigoCia = 0;
    let savedSample = sampleSaved;

    const resolvedUserId = this.resolveReportUserId(normalizedReport.userId, reportUserId);

    if (resolvedUserId === null) {
      reportsMissingCodigoCia = 1;
      log.warn(`[VexpensesApprovedReportsService] Report ${reportId} ignorado. user_id ausente no payload`);
      await this.registrarReportDescartado(
        reportId,
        "Relatório descartado: user_id ausente no payload",
        {
          payingCompanyIds: this.collectPayingCompanyIds(expenses),
          valorDocumento: this.sumExpenses(expenses),
          approvalDate,
        },
      );
      return {
        skippedReports: 0,
        processedReports: 1,
        processedExpenses: 0,
        expensesMissingCardCode: 0,
        expensesMissingCostCenterIntegration: 0,
        expensesMissingPayingCompany: 0,
        expensesMissingAccountingAccount: 0,
        reportsMissingCodigoCia,
        reportsWithoutExpenses: 0,
        sampleSaved,
      };
    }

    const reportCodigoCia = await this.getCodigoCiaByUser(resolvedUserId, teamMemberIntegrationCache);

    if (!reportCodigoCia) {
      reportsMissingCodigoCia = 1;
      log.warn(
        `[VexpensesApprovedReportsService] Report ${reportId} ignorado. Usuario ${resolvedUserId} sem parameters.base para codigoCia`,
      );
      const nomeColaborador = await this.getNome(resolvedUserId, teamMemberIntegrationCache);
      const colaboradorLabel = nomeColaborador
        ? `${nomeColaborador} (${resolvedUserId})`
        : `${resolvedUserId}`;
      await this.registrarReportDescartado(
        reportId,
        `Relatório descartado: colaborador ${colaboradorLabel} sem parameters.base (codigoCia) no VExpenses`,
        {
          payingCompanyIds: this.collectPayingCompanyIds(expenses),
          cardCode: await this.getCardCode(resolvedUserId, teamMemberIntegrationCache),
          nomeColaborador,
          valorDocumento: this.sumExpenses(expenses),
          approvalDate,
        },
      );
      return {
        skippedReports: 0,
        processedReports: 1,
        processedExpenses: 0,
        expensesMissingCardCode: 0,
        expensesMissingCostCenterIntegration: 0,
        expensesMissingPayingCompany: 0,
        expensesMissingAccountingAccount: 0,
        reportsMissingCodigoCia,
        reportsWithoutExpenses: 0,
        sampleSaved,
      };
    }

    if (!expenses.length) {
      reportsWithoutExpenses = 1;
      await this.saveEmptyReportSample(reportWithExpenses, reportId, sampleSaved);
      savedSample = true;
      await this.registrarReportDescartado(reportId, "Relatório descartado: sem despesas", {
        cardCode: await this.getCardCode(resolvedUserId, teamMemberIntegrationCache),
        nomeColaborador: await this.getNome(resolvedUserId, teamMemberIntegrationCache),
        valorDocumento: this.sumExpenses(expenses),
        approvalDate,
      });
    }

    for (const expense of expenses) {
      const cardCode = await this.getCardCode(expense.user_id, teamMemberIntegrationCache);

      if (!cardCode) {
        expensesMissingCardCode += 1;
        log.warn(
          `[VexpensesApprovedReportsService] Expense ${expense.id} ignorada. Colaborador ${expense.user_id} sem integration_id (CardCode)`,
        );
        continue;
      }

      const payingCompanyId = expense.paying_company_id;

      if (payingCompanyId === null) {
        expensesMissingPayingCompany += 1;
        log.warn(`[VexpensesApprovedReportsService] Expense ${expense.id} sem paying_company_id`);
        continue;
      }

      const costCenterIntegrationId = await this.getCostCenterIntegrationId(
        payingCompanyId,
        costCenterIntegrationCache,
      );

      if (!costCenterIntegrationId) {
        expensesMissingCostCenterIntegration += 1;
        log.warn(
          `[VexpensesApprovedReportsService] Expense ${expense.id} ignorada. paying_company_id=${payingCompanyId} sem integration_id no costs-centers`,
        );
        continue;
      }

      const accountingAccount = this.getAccountingAccountByExpenseType(
        expense.expense_type_id,
        expenseTypeIntegrationMap,
      );

      if (!accountingAccount) {
        expensesMissingAccountingAccount += 1;
        log.warn(
          `[VexpensesApprovedReportsService] Expense ${expense.id} ignorada. expense_type ${expense.expense_type_id} sem integration_id (conta contabil)`,
        );
        continue;
      }

      const nomeColaborador = await this.getNome(expense.user_id, teamMemberIntegrationCache);
      const currentByCardCode = groupedExpenses[cardCode] ?? {};
      const current = currentByCardCode[accountingAccount] ?? { reportsCount: 0, reports: {} };
      const currentReport = current.reports[reportId] ?? { expenses: [], expensesCount: 0 };
      const groupedExpense: VexpensesGroupedExpense = {
        ...expense,
        cost_center_integration_id: costCenterIntegrationId,
        codigo_cia: reportCodigoCia,
        nome_colaborador: nomeColaborador,
      };

      currentReport.expenses = [...currentReport.expenses, groupedExpense];
      currentReport.expensesCount += 1;

      if (!current.reports[reportId]) {
        current.reportsCount += 1;
      }

      current.reports[reportId] = currentReport;
      currentByCardCode[accountingAccount] = current;
      groupedExpenses[cardCode] = currentByCardCode;
      processedExpenses += 1;
    }

    if (expenses.length > 0 && processedExpenses === 0) {
      const motivo =
        `Relatório descartado: nenhuma despesa aproveitada ` +
        `(semCardCode=${expensesMissingCardCode}, semPayingCompany=${expensesMissingPayingCompany}, ` +
        `semCentroCusto=${expensesMissingCostCenterIntegration}, semContaContabil=${expensesMissingAccountingAccount})`;
      await this.registrarReportDescartado(reportId, motivo, {
        payingCompanyIds: this.collectPayingCompanyIds(expenses),
        cardCode: await this.getCardCode(resolvedUserId, teamMemberIntegrationCache),
        nomeColaborador: await this.getNome(resolvedUserId, teamMemberIntegrationCache),
        valorDocumento: this.sumExpenses(expenses),
        approvalDate,
      });
    }

    return {
      skippedReports: 0,
      processedReports: 1,
      processedExpenses,
      expensesMissingCardCode,
      expensesMissingCostCenterIntegration,
      expensesMissingPayingCompany,
      expensesMissingAccountingAccount,
      reportsMissingCodigoCia,
      reportsWithoutExpenses,
      sampleSaved: savedSample,
    };
  }

  private async buildExpenseTypeIntegrationMap(): Promise<Map<number, string>> {
    const expenseTypes = await this.vexpensesApi.getExpenseTypes();
    const expenseTypeIntegrationMap = new Map<number, string>();

    for (const expenseType of expenseTypes) {
      if (!expenseType?.id) {
        continue;
      }

      const integrationId = expenseType.integration_id?.trim();

      if (!integrationId) {
        continue;
      }

      expenseTypeIntegrationMap.set(expenseType.id, integrationId);
    }

    return expenseTypeIntegrationMap;
  }

  private getAccountingAccountByExpenseType(
    expenseTypeId: number,
    expenseTypeIntegrationMap: Map<number, string>,
  ): string | null {
    const accountingAccount = expenseTypeIntegrationMap.get(expenseTypeId);

    if (accountingAccount) {
      return accountingAccount;
    }

    log.warn(
      `[VexpensesApprovedReportsService] ExpenseType ${expenseTypeId} sem integration_id para conta contabil`,
    );
    return null;
  }

  private async fetchControleStatusMap(reportIds: number[]): Promise<Map<number, string>> {
    if (!reportIds.length) {
      return new Map();
    }

    const chunks = this.chunkArray(reportIds, REPORT_CHUNK_SIZE);
    const statusByReportId = new Map<number, string>();

    for (const chunk of chunks) {
      const controles = await s4DotzClient.controleExpense.findMany({
        where: {
          reportId: {
            in: chunk,
          },
        },
        select: {
          reportId: true,
          status: true,
        },
      });

      for (const controle of controles) {
        statusByReportId.set(controle.reportId, controle.status);
      }
    }

    return statusByReportId;
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    return chunkArray(items, size);
  }

  private async getCardCode(
    userId: number,
    cache: Map<number, TeamMemberIntegrationData>,
  ): Promise<string | null> {
    const teamMemberData = await this.getTeamMemberIntegrationData(userId, cache);
    return teamMemberData?.cardCode ?? null;
  }

  private async getCodigoCiaByUser(
    userId: number,
    cache: Map<number, TeamMemberIntegrationData>,
  ): Promise<string | null> {
    const teamMemberData = await this.getTeamMemberIntegrationData(userId, cache);
    return teamMemberData?.codigoCia ?? null;
  }

  private async getNome(
    userId: number,
    cache: Map<number, TeamMemberIntegrationData>,
  ): Promise<string | null> {
    const teamMemberData = await this.getTeamMemberIntegrationData(userId, cache);
    return teamMemberData?.nome ?? null;
  }

  private async getTeamMemberIntegrationData(
    userId: number,
    cache: Map<number, TeamMemberIntegrationData>,
  ): Promise<TeamMemberIntegrationData | null> {
    if (cache.has(userId)) {
      return cache.get(userId) ?? null;
    }

    let teamMember: VexpensesTeamMember | null = null;

    try {
      teamMember = await this.vexpensesApi.getTeamMember(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`[VexpensesApprovedReportsService] Falha ao buscar team-member ${userId}: ${message}`);
      cache.set(userId, { cardCode: null, codigoCia: null, nome: null });
      return null;
    }

    const cardCode = teamMember?.integration_id?.trim() || null;
    const codigoCia = teamMember?.parameters?.base?.trim() || null;
    const nome = teamMember?.name?.trim() || null;

    if (!cardCode) {
      log.warn(`[VexpensesApprovedReportsService] Usuario ${userId} sem integration_id (CardCode)`);
    }

    if (!codigoCia) {
      log.warn(`[VexpensesApprovedReportsService] Usuario ${userId} sem parameters.base (codigoCia)`);
    }

    const result: TeamMemberIntegrationData = {
      cardCode,
      codigoCia,
      nome,
    };

    cache.set(userId, result);
    return result;
  }

  private async getCostCenterIntegrationId(
    payingCompanyId: number,
    cache: Map<number, string | null>,
  ): Promise<string | null> {
    if (cache.has(payingCompanyId)) {
      return cache.get(payingCompanyId) ?? null;
    }

    try {
      const costCenter = await this.vexpensesApi.getCostCenter(payingCompanyId);
      const integrationId = costCenter?.integration_id?.trim() || null;
      cache.set(payingCompanyId, integrationId);
      return integrationId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(
        `[VexpensesApprovedReportsService] Falha ao buscar cost-center ${payingCompanyId}: ${message}`,
      );
      cache.set(payingCompanyId, null);
      return null;
    }
  }

  private extractExpenses(expenses: unknown): VexpensesReportExpense[] {
    return extractExpenses(expenses, () => {
      log.warn("[VexpensesApprovedReportsService] Formato inesperado de expenses no report");
    });
  }

  private normalizeReportWithExpenses(
    payload: unknown,
    reportId: number,
  ): { expenses: unknown; userId: number | null } | null {
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "expenses" in payload) {
      const report = payload as { expenses: unknown; user_id?: unknown };
      return {
        expenses: report.expenses,
        userId: this.normalizeUserId(report.user_id),
      };
    }

    if (Array.isArray(payload)) {
      const first = payload.find((item) => item && typeof item === "object" && "expenses" in item) as
        | { expenses: unknown; user_id?: unknown }
        | undefined;

      if (first) {
        return {
          expenses: first.expenses,
          userId: this.normalizeUserId(first.user_id),
        };
      }
    }

    log.warn(`[VexpensesApprovedReportsService] Report ${reportId} com payload inesperado para expenses`);
    return null;
  }

  private normalizeUserId(value: unknown): number | null {
    const userId = Number(value);

    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    return userId;
  }

  private resolveReportUserId(payloadUserId: number | null, fallbackUserId: number): number | null {
    if (payloadUserId !== null) {
      return payloadUserId;
    }

    const normalizedFallback = this.normalizeUserId(fallbackUserId);
    return normalizedFallback;
  }

  private async saveEmptyReportSample(report: unknown, reportId: number, alreadySaved: boolean): Promise<void> {
    if (alreadySaved) {
      return;
    }

    try {
      const tmpDir = path.resolve(process.cwd(), "tmp");
      await mkdir(tmpDir, { recursive: true });
      const outputPath = path.join(tmpDir, "vexpenses-empty-report-sample.json");
      await writeFile(
        outputPath,
        JSON.stringify({ reportId, payload: report }, null, 2),
        "utf8",
      );
      log.warn(`[VexpensesApprovedReportsService] Report ${reportId} sem despesas. Sample salvo em ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`[VexpensesApprovedReportsService] Falha ao salvar sample de report vazio: ${message}`);
    }
  }

  /**
   * Monta a janela de busca por approval_date. Chamada sem `date` (1ª iteração do run):
   * ancora em `dataAprovacao` mais recente já salva em controle_expense (ou início do ano,
   * se nunca houve nada salvo), com `diasPassados` de margem pra trás — reprocessa a
   * janela recente pra recapturar falhas temporárias. Chamada com `date` (iterações
   * seguintes, ver loop em `execute`): retoma no dia seguinte ao fim da janela anterior e
   * avança `diasPassados` por vez, sem ultrapassar hoje, até alcançar a data atual.
   */
  private async buildApprovalDateSearch(date?: Date): Promise<{ search: string; endDate: Date }> {
    const diasPassados = this.resolveDiasPassados();
    const today = this.toUtcDate(new Date());

    if (date) {
      // Retoma no dia seguinte ao fim da janela anterior — nunca no mesmo dia, senão o
      // último dia da janela anterior seria buscado (e reprocessado) de novo aqui.
      const windowStart = addDays(date, 1);
      // Avança até `diasPassados` dias à frente, sem nunca ultrapassar hoje.
      const windowEnd = this.minDate(addDays(windowStart, diasPassados), today);
      const start = this.formatDateYYYYMMDD(windowStart);
      const end = this.formatDateYYYYMMDD(windowEnd);
      return { search: `approval_date:${start},${end}`, endDate: windowEnd };
    }

    const latestApproval = await s4DotzClient.controleExpense.findFirst({
      where: {
        dataAprovacao: {
          not: null,
        },
      },
      orderBy: {
        dataAprovacao: "desc",
      },
      select: {
        dataAprovacao: true,
      },
    });

    if (!latestApproval?.dataAprovacao) {
      // Nunca processou nada antes: começa do 1º de janeiro do ano atual e avança em
      // janelas de `diasPassados` a partir daí (não busca o ano inteiro de uma vez).
      const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const windowEnd = this.minDate(addDays(startOfYear, diasPassados), today);
      const start = this.formatDateYYYYMMDD(startOfYear);
      const end = this.formatDateYYYYMMDD(windowEnd);
      return { search: `approval_date:${start},${end}`, endDate: windowEnd };
    }

    // 1ª janela do run quando já existe histórico: os `diasPassados` dias ANTES da
    // última aprovação conhecida — margem de segurança para recapturar qualquer coisa
    // que tenha falhado numa execução anterior. As janelas seguintes (bloco acima)
    // avançam a partir daqui para frente, até chegar em hoje.
    const latestDate = this.toUtcDate(latestApproval.dataAprovacao);
    const startDate = subDays(latestDate, diasPassados);
    const start = this.formatDateYYYYMMDD(startDate);
    const end = this.formatDateYYYYMMDD(latestDate);
    return { search: `approval_date:${start},${end}`, endDate: latestDate };
  }

  // Menor das duas datas — usado para nunca deixar uma janela ultrapassar hoje.
  private minDate(a: Date, b: Date): Date {
    return a.getTime() < b.getTime() ? a : b;
  }

  private resolveDiasPassados(): number {
    return resolveDiasPassados(Config.VEXPENSES_DIAS_PASSADOS);
  }

  private toUtcDate(date: Date): Date {
    return toUtcDate(date);
  }

  private formatDateYYYYMMDD(date: Date): string {
    return formatDateYYYYMMDD(date);
  }

  private async buildIntegrationJson(
    groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany,
    approvalDateByReportId: Map<number, Date | null>,
  ): Promise<VexpensesIntegrationJson[]> {
    const integrations: VexpensesIntegrationJson[] = [];
    const reportAggregates = this.aggregateByReport(groupedExpenses);

    for (const aggregate of reportAggregates) {
      try {
        if (!aggregate.cardCode) {
          log.warn(`[VexpensesApprovedReportsService] CardCode nao encontrado para report ${aggregate.reportId}`);
          continue;
        }

        if (!aggregate.expenses.length) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} descartado ao montar integracao: agrupamento sem despesas`,
          );
          await this.registrarReportDescartado(
            aggregate.reportId,
            "Relatório descartado: agrupamento sem despesas",
            { payingCompanyIds: aggregate.payingCompanyIds, cardCode: aggregate.cardCode },
          );
          continue;
        }

        if (!aggregate.codigoCia) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} ignorado ao montar integracao: codigoCia ausente`,
          );
          continue;
        }

        const ciaId = await this.ciaVexpenseRepository.resolverCiaId(aggregate.codigoCia);
        if (ciaId === null) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} descartado: CIA ${aggregate.codigoCia} não cadastrada`,
          );
          await this.registrarReportDescartado(
            aggregate.reportId,
            `Relatório descartado: CIA ${aggregate.codigoCia} não cadastrada (de-para cia)`,
            { payingCompanyIds: aggregate.payingCompanyIds, cardCode: aggregate.cardCode },
          );
          continue;
        }

        const configVex = await this.configContabilVexpenseRepository.buscar(ciaId);
        if (!configVex) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} descartado: Configuração contábil Vexpense não cadastrada para CIA ${aggregate.codigoCia}`,
          );
          await this.registrarReportDescartado(
            aggregate.reportId,
            `Relatório descartado: Configuração contábil Vexpense não cadastrada para CIA ${aggregate.codigoCia}`,
            { payingCompanyIds: aggregate.payingCompanyIds, cardCode: aggregate.cardCode },
          );
          continue;
        }

        const lancamentos = this.buildLancamentos(aggregate.accountingAccountExpenses);

        if (!lancamentos.length) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} descartado ao montar integracao: nenhum lançamento contábil gerado`,
          );
          await this.registrarReportDescartado(
            aggregate.reportId,
            "Relatório descartado: nenhum lançamento contábil gerado",
            { payingCompanyIds: aggregate.payingCompanyIds, cardCode: aggregate.cardCode },
          );
          continue;
        }

        // Documento negativo; os lançamentos contábeis são positivos (buildLancamentos).
        const valorDocumento = this.toNegative(this.sumLancamentos(lancamentos));
        const referenciaExpense = aggregate.expenses[0];
        const nomeColaborador = referenciaExpense.nome_colaborador ?? null;
        const hoje = new Date();
        const protocolo = await this.resolveProtocolo(aggregate.reportId);
        const approvalDate = approvalDateByReportId.get(aggregate.reportId) ?? null;

        const saved = await this.saveControleExpense({
          reportId: aggregate.reportId,
          cardCode: aggregate.cardCode,
          payingCompanyIds: aggregate.payingCompanyIds,
          protocolo,
          approvalDate,
          nomeColaborador,
          valorDocumento,
          codigoCia: aggregate.codigoCia,
          fiscalYear: this.formatDateYYYYMMDD(hoje).slice(0, 4),
        });

        if (!saved) {
          log.warn(
            `[VexpensesApprovedReportsService] Report ${aggregate.reportId} descartado: falha ao salvar controle_expense (empresa pagadora ausente)`,
          );
          await this.registrarReportDescartado(
            aggregate.reportId,
            "Relatório descartado: falha ao salvar controle (empresa pagadora ausente)",
            { cardCode: aggregate.cardCode },
          );
          continue;
        }

        integrations.push({
          tipoArApGl: configVex.tipoArApGl,
          tipoDocumento: configVex.tipoDocumento,
          codigoCia: aggregate.codigoCia,
          numeroDocumento: protocolo,
          textoDocumento: `${configVex.textoDocumento}${aggregate.reportId}`.slice(0, TEXTO_DOCUMENTO_MAX_LENGTH),
          valorDocumento,
          codigoParceiro: aggregate.cardCode,
          dataEmissao: this.formatDateYYYYMMDD(hoje),
          dataVencimento: "",
          condicaoPagto: "",
          dataLancamento: this.formatDateYYYYMMDD(hoje),
          usuarioLancamento: USUARIO_LANCAMENTO,
          lancamentosContabeis: lancamentos,
          anexos: [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`[VexpensesApprovedReportsService] Erro ao montar integracao do report ${aggregate.reportId}: ${message}`);
      }
    }

    return integrations;
  }

  private aggregateByReport(
    groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany,
  ): Array<{
    reportId: number;
    cardCode: string;
    codigoCia: string;
    accountingAccountExpenses: Record<string, VexpensesGroupedExpense[]>;
    payingCompanyIds: number[];
    expenses: VexpensesGroupedExpense[];
  }> {
    return aggregateByReport(groupedExpenses, ({ reportId, existingCardCode, incomingCardCode }) => {
      log.warn(
        `[VexpensesApprovedReportsService] Report ${reportId} com cardCodes diferentes (${existingCardCode} vs ${incomingCardCode}).`,
      );
    });
  }

  private buildLancamentos(
    accountingAccountExpenses: Record<string, VexpensesGroupedExpense[]>,
  ): VexpensesIntegrationLancamento[] {
    return buildLancamentos(accountingAccountExpenses);
  }

  private async saveControleExpense(params: {
    reportId: number;
    cardCode: string;
    payingCompanyIds: number[];
    protocolo: string;
    approvalDate: Date | null;
    nomeColaborador: string | null;
    valorDocumento: number;
    codigoCia: string | null;
    fiscalYear: string | null;
  }): Promise<boolean> {
    const { reportId, cardCode, payingCompanyIds, protocolo, approvalDate, nomeColaborador, valorDocumento, codigoCia, fiscalYear } = params;
    const companyIds = [...new Set(payingCompanyIds.filter((value) => Number.isFinite(value)))];

    if (!companyIds.length) {
      return false;
    }

    try {
      const existing = await s4DotzClient.controleExpense.findMany({
        where: { reportId, paying_company_id: { in: companyIds } },
        select: { id: true, paying_company_id: true, status: true },
      });

      const existingByCompany = new Map<number, { id: number; status: string }>();
      for (const item of existing) {
        if (item.paying_company_id !== null) {
          existingByCompany.set(item.paying_company_id, { id: item.id, status: item.status });
        }
      }

      const novosRegistros: Array<Record<string, unknown>> = [];
      let atualizados = 0;

      for (const companyId of companyIds) {
        const found = existingByCompany.get(companyId);

        if (!found) {
          novosRegistros.push({
            reportId,
            paying_company_id: companyId,
            status: "PENDENTE",
            codigoSapColaborador: cardCode,
            codigoProtocoloVexpenses: protocolo,
            nomeColaborador: nomeColaborador ?? undefined,
            valorDocumento,
            codigoCia: codigoCia ?? undefined,
            fiscalYear: fiscalYear ?? undefined,
            dataAprovacao: approvalDate ?? undefined,
          });
          continue;
        }

        if (INTEGRATED_STATUSES.has(found.status)) {
          continue;
        }

        await s4DotzClient.controleExpense.update({
          where: { id: found.id },
          data: {
            status: "PENDENTE",
            codigoSapColaborador: cardCode,
            codigoProtocoloVexpenses: protocolo,
            nomeColaborador: nomeColaborador ?? undefined,
            valorDocumento,
            codigoCia: codigoCia ?? undefined,
            fiscalYear: fiscalYear ?? undefined,
            error_message: null,
            dataAprovacao: approvalDate ?? undefined,
            atualizadoEm: new Date(),
          },
        });
        atualizados += 1;
      }

      if (novosRegistros.length) {
        await s4DotzClient.controleExpense.createMany({ data: novosRegistros as never });
      }

      log.info(
        `[VexpensesApprovedReportsService] ControleExpense upsert. Report=${reportId}, Novos=${novosRegistros.length}, Atualizados=${atualizados}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[VexpensesApprovedReportsService] Erro ao salvar ControleExpense (Report=${reportId}): ${message}`);
      return false;
    }
  }

  private collectPayingCompanyIds(expenses: VexpensesReportExpense[]): number[] {
    const ids = new Set<number>();

    for (const expense of expenses) {
      if (typeof expense.paying_company_id === "number" && Number.isFinite(expense.paying_company_id)) {
        ids.add(expense.paying_company_id);
      }
    }

    return [...ids];
  }

  private async registrarReportDescartado(
    reportId: number,
    motivo: string,
    options: { payingCompanyIds?: number[]; cardCode?: string | null; approvalDate?: Date | null; nomeColaborador?: string | null; valorDocumento?: number | null } = {},
  ): Promise<void> {
    const companyIds = [
      ...new Set((options.payingCompanyIds ?? []).filter((value: number) => Number.isFinite(value))),
    ];

    try {
      const existing = await s4DotzClient.controleExpense.findMany({
        where: { reportId },
        select: { id: true, status: true },
      });

      if (existing.length) {
        const todosDescartados = existing.every((item: { status: string }) => item.status === STATUS_DESCARTADO);

        if (!todosDescartados) {
          return;
        }

        await s4DotzClient.controleExpense.updateMany({
          where: { reportId, status: STATUS_DESCARTADO },
          data: {
            error_message: motivo,
            codigoSapColaborador: options.cardCode ?? undefined,
            nomeColaborador: options.nomeColaborador ?? undefined,
            valorDocumento: options.valorDocumento ?? undefined,
            atualizadoEm: new Date(),
          },
        });

        log.warn(`[VexpensesApprovedReportsService] Report ${reportId} descartado (atualizado): ${motivo}`);
        return;
      }

      const baseData = {
        reportId,
        status: STATUS_DESCARTADO,
        error_message: motivo,
        codigoSapColaborador: options.cardCode ?? undefined,
        nomeColaborador: options.nomeColaborador ?? undefined,
        valorDocumento: options.valorDocumento ?? undefined,
        dataAprovacao: options.approvalDate ?? undefined,
      };

      const novosRegistros = companyIds.length
        ? companyIds.map((companyId) => ({ ...baseData, paying_company_id: companyId }))
        : [{ ...baseData, paying_company_id: null }];

      await s4DotzClient.controleExpense.createMany({ data: novosRegistros });
      log.warn(`[VexpensesApprovedReportsService] Report ${reportId} descartado: ${motivo}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[VexpensesApprovedReportsService] Falha ao registrar descarte do report ${reportId}: ${message}`);
    }
  }

  private async removeDescartePlaceholders(reportId: number): Promise<void> {
    // Remove apenas as linhas-placeholder de descarte SEM empresa pagadora: elas nao
    // tem paying_company_id e por isso nao seriam reaproveitadas pelo upsert do
    // saveControleExpense (que casa por reportId + paying_company_id), virando orfas.
    // Descartes COM empresa sao transicionados para PENDENTE pelo proprio upsert.
    await s4DotzClient.controleExpense.deleteMany({
      where: { reportId, paying_company_id: null, status: STATUS_DESCARTADO },
    });
  }

  async reprocessReport(reportId: number): Promise<void> {
    log.info(`[VexpensesApprovedReportsService] Reprocessando report ${reportId}`);
    const report = await this.vexpensesApi.getReport(reportId);

    await this.removeDescartePlaceholders(reportId);

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const teamMemberIntegrationCache = new Map<number, TeamMemberIntegrationData>();
    const costCenterIntegrationCache = new Map<number, string | null>();
    const expenseTypeIntegrationMap = await this.buildExpenseTypeIntegrationMap();
    const approvalDate = report.approval_date ? this.parseExpenseDate(report.approval_date) : null;

    await this.processReport(
      reportId,
      report.user_id,
      undefined,
      groupedExpenses,
      teamMemberIntegrationCache,
      costCenterIntegrationCache,
      expenseTypeIntegrationMap,
      approvalDate,
      true, // sampleSaved: nao salvar sample de debug em reprocesso manual
    );

    const integracoes = await this.buildIntegrationJson(
      groupedExpenses,
      new Map([[reportId, approvalDate]]),
    );
    await this.enqueueIntegrations(integracoes);

    log.info(
      `[VexpensesApprovedReportsService] Report ${reportId} reprocessado. Integracoes enfileiradas=${integracoes.length}`,
    );
  }

  private async sendIntegrationsToSap(integracoes: VexpensesIntegrationJson[]): Promise<void> {
    if (!integracoes.length) {
      return;
    }

    for (const integracao of integracoes) {
      try {
        log.info(`[VexpensesApprovedReportsService] Enviando integracao SAP ${integracao.numeroDocumento}`);
        const response = await this.integracaoSapService.execute(integracao as any);
        await this.handleSapResponse(integracao, response);
      } catch (error: any) {
        const message = error?.response?.data?.mensagem || error?.message || "Erro desconhecido";
        log.error(`[VexpensesApprovedReportsService] Falha ao enviar integracao SAP ${integracao.numeroDocumento}: ${message}`);
        await this.updateControleExpenseStatus(
          integracao.numeroDocumento,
          "ERRO_INTEGRACAO_SAP",
          message,
          null,
          JSON.stringify(integracao),
          error?.response?.data !== undefined ? JSON.stringify(error.response.data) : null,
        );
      }
    }
  }

  private async enqueueIntegrations(integracoes: VexpensesIntegrationJson[]): Promise<void> {
    if (!integracoes.length) {
      return;
    }

    for (const integracao of integracoes) {
      try {
        await publishVexpensesSAPIntegration({
          protocolo: integracao.numeroDocumento,
          integracao,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[VexpensesApprovedReportsService] Erro ao enfileirar integracao ${integracao.numeroDocumento}: ${message}`,
        );
      }
    }
  }

  private async handleSapResponse(integracao: VexpensesIntegrationJson, response: any): Promise<void> {
    const requestJson = JSON.stringify(integracao);
    const responseJson = response?.data !== undefined ? JSON.stringify(response.data) : null;

    if (response?.status === 201) {
      const numeroDocumentoERP = response?.data?.numeroDocumentoERP || null;
      await this.updateControleExpenseStatus(
        integracao.numeroDocumento,
        "INTEGRADO_SAP",
        null,
        numeroDocumentoERP,
        requestJson,
        responseJson,
      );
      return;
    }

    const mensagem = response?.data?.mensagem || `Status inesperado: ${response?.status ?? "NAO_INFORMADO"}`;
    await this.updateControleExpenseStatus(integracao.numeroDocumento, "ERRO_INTEGRACAO_SAP", mensagem, null, requestJson, responseJson);
  }

  private async updateControleExpenseStatus(
    protocolo: string,
    status: string,
    errorMessage: string | null,
    codigoDocumentoERP?: string | null,
    request?: string | null,
    response?: string | null,
  ): Promise<void> {
    try {
      await s4DotzClient.controleExpense.updateMany({
        where: {
          codigoProtocoloVexpenses: protocolo,
        },
        data: {
          status,
          codigoDocumentoERP: codigoDocumentoERP ?? undefined,
          error_message: errorMessage ?? undefined,
          request: request ?? undefined,
          response: response ?? undefined,
          dataImportacao: status === "INTEGRADO_SAP" ? new Date() : undefined,
          atualizadoEm: new Date(),
        },
      });

      log.info(
        `[VexpensesApprovedReportsService] ControleExpense atualizado. Protocolo=${protocolo}, Status=${status}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[VexpensesApprovedReportsService] Erro ao atualizar ControleExpense (${protocolo}): ${message}`);
    }
  }

  private sumExpenses(expenses: VexpensesReportExpense[]): number {
    return sumExpenses(expenses);
  }

  private sumLancamentos(lancamentos: VexpensesIntegrationLancamento[]): number {
    return sumLancamentos(lancamentos);
  }

  private toNegative(value: number): number {
    return toNegative(value);
  }

  private parseExpenseDate(date: string | null | undefined): Date {
    return parseExpenseDate(date);
  }

  private async resolveProtocolo(reportId: number): Promise<string> {
    // Número do documento enviado ao SAP = "VEX-" + id do relatório (determinístico por report).
    // É também a chave de rastreio (codigoProtocoloVexpenses) no controle_expense.
    return `VEX-${reportId}`;
  }
}
