import {
  VexpensesGroupedExpensesByCardCodeAndCompany,
  VexpensesGroupedExpense,
  VexpensesIntegrationLancamento,
} from "@/cron/modules/vexpenses/types/expenses.types";
import {
  addPayingCompanyIds,
  buildPayingCompanyIdSet,
  groupExpensesByCostCenterIntegration,
  sumExpenses,
} from "@/cron/modules/vexpenses/utils/vexpensesCollectionUtils";

export type VexpensesReportAggregate = {
  reportId: number;
  cardCode: string;
  codigoCia: string;
  accountingAccountExpenses: Record<string, VexpensesGroupedExpense[]>;
  payingCompanyIds: number[];
  expenses: VexpensesGroupedExpense[];
};

type MutableVexpensesReportAggregate = {
  reportId: number;
  cardCode: string;
  codigoCia: string;
  accountingAccountExpenses: Record<string, VexpensesGroupedExpense[]>;
  payingCompanyIds: Set<number>;
  expenses: VexpensesGroupedExpense[];
};

export function aggregateByReport(
  groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany,
  onMismatchedCardCode?: (params: { reportId: number; existingCardCode: string; incomingCardCode: string }) => void,
): VexpensesReportAggregate[] {
  const reportMap = new Map<number, MutableVexpensesReportAggregate>();

  for (const [cardCode, accountingAccountGroups] of Object.entries(groupedExpenses)) {
    for (const [accountingAccount, group] of Object.entries(accountingAccountGroups)) {
      for (const [reportIdKey, report] of Object.entries(group.reports)) {
        const reportId = Number(reportIdKey);
        mergeReportExpenses({
          reportMap,
          reportId,
          cardCode,
          accountingAccount,
          expenses: report.expenses,
          onMismatchedCardCode,
        });
      }
    }
  }

  return Array.from(reportMap.values()).map((report) => ({
    reportId: report.reportId,
    cardCode: report.cardCode,
    codigoCia: report.codigoCia,
    accountingAccountExpenses: report.accountingAccountExpenses,
    payingCompanyIds: Array.from(report.payingCompanyIds.values()),
    expenses: report.expenses,
  }));
}

export function mergeReportExpenses(params: {
  reportMap: Map<number, MutableVexpensesReportAggregate>;
  reportId: number;
  cardCode: string;
  accountingAccount: string;
  expenses: VexpensesGroupedExpense[];
  onMismatchedCardCode?: (params: {
    reportId: number;
    existingCardCode: string;
    incomingCardCode: string;
  }) => void;
}): void {
  const {
    reportMap,
    reportId,
    cardCode,
    accountingAccount,
    expenses,
    onMismatchedCardCode,
  } = params;
  const existing = reportMap.get(reportId);

  if (!existing) {
    reportMap.set(reportId, {
      reportId,
      cardCode,
      codigoCia: expenses[0]?.codigo_cia ?? "",
      accountingAccountExpenses: { [accountingAccount]: [...expenses] },
      payingCompanyIds: buildPayingCompanyIdSet(expenses),
      expenses: [...expenses],
    });
    return;
  }

  if (existing.cardCode !== cardCode) {
    onMismatchedCardCode?.({
      reportId,
      existingCardCode: existing.cardCode,
      incomingCardCode: cardCode,
    });
  }

  const incomingCodigoCia = expenses[0]?.codigo_cia ?? "";
  if (incomingCodigoCia && existing.codigoCia !== incomingCodigoCia) {
    existing.codigoCia = incomingCodigoCia;
  }

  const currentExpenses = existing.accountingAccountExpenses[accountingAccount] ?? [];
  existing.accountingAccountExpenses[accountingAccount] = [...currentExpenses, ...expenses];
  addPayingCompanyIds(existing.payingCompanyIds, expenses);
  existing.expenses = [...existing.expenses, ...expenses];
}

export function buildLancamentos(
  accountingAccountExpenses: Record<string, VexpensesGroupedExpense[]>,
): VexpensesIntegrationLancamento[] {
  const lancamentos: VexpensesIntegrationLancamento[] = [];

  for (const [accountingAccount, expenses] of Object.entries(accountingAccountExpenses)) {
    const expensesList = Array.isArray(expenses) ? expenses : [];

    if (!expensesList.length) {
      continue;
    }

    const expensesByCostCenter = groupExpensesByCostCenterIntegration(expensesList);

    for (const [costCenterIntegrationId, companyExpenses] of expensesByCostCenter) {
      const total = sumExpenses(companyExpenses);

      lancamentos.push({
        conta: accountingAccount,
        centroCusto: costCenterIntegrationId,
        valor: total,
      });
    }
  }

  return lancamentos;
}
