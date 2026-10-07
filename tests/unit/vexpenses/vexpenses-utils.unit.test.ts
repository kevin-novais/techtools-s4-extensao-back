import { describe, expect, it } from "vitest";
import {
  chunkArray,
  extractExpenses,
  groupExpensesByCostCenterIntegration,
  sumExpenses,
  sumLancamentos,
  toNegative,
} from "../../../src/cron/modules/vexpenses/utils/vexpensesCollectionUtils";
import {
  formatDateWithTime,
  formatDateYYYYMMDD,
  parseExpenseDate,
  resolveDiasPassados,
  toUtcDate,
} from "../../../src/cron/modules/vexpenses/utils/vexpensesDateUtils";
import {
  aggregateByReport,
  buildLancamentos,
} from "../../../src/cron/modules/vexpenses/utils/vexpensesIntegrationBuilder";
import {
  VexpensesGroupedExpense,
  VexpensesGroupedExpensesByCardCodeAndCompany,
  VexpensesReportExpense,
} from "../../../src/cron/modules/vexpenses/types/expenses.types";

function makeExpense(params: {
  id: number;
  expenseId: number;
  userId?: number;
  date?: string;
  value?: number;
  payingCompanyId?: number | null;
  expenseTypeId?: number;
}): VexpensesReportExpense {
  return {
    id: params.id,
    user_id: params.userId ?? 1,
    expense_id: params.expenseId,
    device_id: null,
    integration_id: null,
    external_id: null,
    mileage: "0",
    date: params.date ?? "2026-03-01",
    expense_type_id: params.expenseTypeId ?? 10,
    payment_method_id: null,
    paying_company_id: params.payingCompanyId ?? 1001,
    course_id: null,
    reicept_url: null,
    value: params.value ?? 10,
    title: "Despesa",
    validate: "ok",
    reimbursable: true,
    observation: null,
    rejected: 0,
    on: true,
    mileage_value: "0",
    original_currency_iso: null,
    exchange_rate: null,
    converted_value: null,
    converted_currency_iso: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  };
}

describe("vexpensesCollectionUtils", () => {
  it("deve agrupar coleções e calcular totais", () => {
    const chunks = chunkArray([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);

    const arrExpense = makeExpense({ id: 1, expenseId: 101, value: 11.25, payingCompanyId: 7001 });
    const wrappedExpense = makeExpense({ id: 2, expenseId: 102, value: 12.75, payingCompanyId: 7001 });

    expect(extractExpenses([arrExpense]).length).toBe(1);
    expect(extractExpenses({ data: [wrappedExpense] }).length).toBe(1);
    expect(extractExpenses({ foo: "bar" }).length).toBe(0);

    const grouped = groupExpensesByCostCenterIntegration([
      {
        ...arrExpense,
        cost_center_integration_id: "CC-7001",
        codigo_cia: "CIA01",
      },
      {
        ...wrappedExpense,
        cost_center_integration_id: "CC-7001",
        codigo_cia: "CIA01",
      },
    ]);
    expect(grouped.get("CC-7001")?.length).toBe(2);

    const totalExpenses = sumExpenses([arrExpense, wrappedExpense]);
    expect(totalExpenses).toBe(24);
    expect(toNegative(totalExpenses)).toBe(-24);
    expect(sumLancamentos([{ valor: -10.25 }, { valor: -5.75 }])).toBe(-16);
  });
});

describe("vexpensesDateUtils", () => {
  it("deve formatar e converter datas", () => {
    expect(resolveDiasPassados("10")).toBe(10);
    expect(resolveDiasPassados("invalid")).toBe(7);

    const utcDate = toUtcDate(new Date("2026-03-02T18:30:00.000Z"));
    expect(utcDate.toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(formatDateYYYYMMDD(utcDate)).toBe("2026-03-02");
    expect(formatDateWithTime(utcDate)).toBe("2026-03-02T00:00:00");

    const parsed = parseExpenseDate("2026-03-01");
    expect(parsed.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("vexpensesIntegrationBuilder", () => {
  it("deve agregar relatórios e montar lançamentos", () => {
    const expenseA: VexpensesGroupedExpense = {
      ...makeExpense({ id: 10, expenseId: 201, value: 25, payingCompanyId: 5001 }),
      cost_center_integration_id: "CC-5001",
      codigo_cia: "CIA01",
    };
    const expenseB: VexpensesGroupedExpense = {
      ...makeExpense({ id: 11, expenseId: 202, value: 5.5, payingCompanyId: 5001 }),
      cost_center_integration_id: "CC-5001",
      codigo_cia: "CIA01",
    };
    const expenseC: VexpensesGroupedExpense = {
      ...makeExpense({ id: 12, expenseId: 203, value: 4.5, payingCompanyId: 5002 }),
      cost_center_integration_id: "CC-5002",
      codigo_cia: "CIA01",
    };

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {
      C0001: {
        "6.1.1.01": {
          reportsCount: 1,
          reports: {
            999: {
              expenses: [expenseA, expenseB],
              expensesCount: 2,
            },
          },
        },
        "6.1.1.02": {
          reportsCount: 1,
          reports: {
            999: {
              expenses: [expenseC],
              expensesCount: 1,
            },
          },
        },
      },
    };

    const aggregates = aggregateByReport(groupedExpenses);
    expect(aggregates.length).toBe(1);
    expect(aggregates[0].reportId).toBe(999);
    expect(aggregates[0].payingCompanyIds.length).toBe(2);
    expect(aggregates[0].expenses.length).toBe(3);
    expect(aggregates[0].codigoCia).toBe("CIA01");

    const lancamentos = buildLancamentos(aggregates[0].accountingAccountExpenses);
    expect(lancamentos.length).toBe(2);

    // Lançamentos contábeis são POSITIVOS (o valorDocumento é que vai negativo).
    const byContaCentro = new Map(lancamentos.map((l) => [`${l.conta}-${l.centroCusto}`, l.valor]));
    expect(byContaCentro.get("6.1.1.01-CC-5001")).toBe(30.5);
    expect(byContaCentro.get("6.1.1.02-CC-5002")).toBe(4.5);
  });
});
