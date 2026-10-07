import { VexpensesGroupedExpense, VexpensesReportExpense } from "@/cron/modules/vexpenses/types/expenses.types";

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function extractExpenses(
  expenses: unknown,
  onUnexpectedFormat?: () => void,
): VexpensesReportExpense[] {
  if (Array.isArray(expenses)) {
    return expenses;
  }

  if (
    expenses &&
    typeof expenses === "object" &&
    "data" in expenses &&
    Array.isArray((expenses as { data?: unknown }).data)
  ) {
    return (expenses as { data: VexpensesReportExpense[] }).data;
  }

  if (expenses) {
    onUnexpectedFormat?.();
  }

  return [];
}

export function addPayingCompanyIds<T extends { paying_company_id: number | null }>(
  payingCompanyIds: Set<number>,
  expenses: T[],
): void {
  for (const expense of expenses) {
    if (expense.paying_company_id === null) {
      continue;
    }

    payingCompanyIds.add(expense.paying_company_id);
  }
}

export function buildPayingCompanyIdSet<T extends { paying_company_id: number | null }>(
  expenses: T[],
): Set<number> {
  const payingCompanyIds = new Set<number>();
  addPayingCompanyIds(payingCompanyIds, expenses);
  return payingCompanyIds;
}

export function groupExpensesByCostCenterIntegration(
  expenses: VexpensesGroupedExpense[],
): Map<string, VexpensesGroupedExpense[]> {
  const expensesByCostCenter = new Map<string, VexpensesGroupedExpense[]>();

  for (const expense of expenses) {
    const integrationId = expense.cost_center_integration_id?.trim();

    if (!integrationId) {
      continue;
    }

    const current = expensesByCostCenter.get(integrationId) ?? [];
    expensesByCostCenter.set(integrationId, [...current, expense]);
  }

  return expensesByCostCenter;
}

export function sumExpenses<T extends { value: number }>(expenses: T[]): number {
  const total = expenses.reduce((acc, expense) => acc + Number(expense.value || 0), 0);
  return Number(total.toFixed(2));
}

export function sumLancamentos(lancamentos: Array<{ valor: number }>): number {
  const total = lancamentos.reduce((acc, lancamento) => acc + lancamento.valor, 0);
  return Number(total.toFixed(2));
}

export function toNegative(value: number): number {
  if (value === 0) {
    return 0;
  }

  return -Math.abs(Number(value.toFixed(2)));
}
