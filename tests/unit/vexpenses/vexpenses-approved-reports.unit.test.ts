import { beforeEach, describe, expect, it, vi } from "vitest";
import { VexpensesGroupedExpensesByCardCodeAndCompany, VexpensesReportExpense } from "../../../src/cron/modules/vexpenses/types/expenses.types";
import { VexpensesApprovedReportsService } from "../../../src/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

const { controleExpenseMock } = vi.hoisted(() => ({
  controleExpenseMock: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { controleExpense: controleExpenseMock },
}));

function makeExpense(params: {
  id: number;
  userId: number;
  payingCompanyId: number | null;
  expenseTypeId?: number;
  value?: number;
}): VexpensesReportExpense {
  return {
    id: params.id,
    user_id: params.userId,
    expense_id: 1000 + params.id,
    device_id: null,
    integration_id: null,
    external_id: null,
    mileage: "0",
    date: "2026-03-01",
    expense_type_id: params.expenseTypeId ?? 10,
    payment_method_id: null,
    paying_company_id: params.payingCompanyId,
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

describe("VexpensesApprovedReportsService - processReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controleExpenseMock.findMany.mockResolvedValue([]);
    controleExpenseMock.createMany.mockResolvedValue({ count: 1 });
    controleExpenseMock.updateMany.mockResolvedValue({ count: 0 });
  });

  it("deve ignorar despesa quando paying_company_id for null", async () => {
    const service = new VexpensesApprovedReportsService() as any;
    const getTeamMemberMock = vi.fn().mockResolvedValue({
      integration_id: "F002549",
      parameters: { base: "CIA01" },
    });
    const getCostCenterMock = vi.fn();
    const getReportExpensesMock = vi.fn().mockResolvedValue({
      id: 9001,
      user_id: 23575,
      expenses: [makeExpense({ id: 1, userId: 23575, payingCompanyId: null })],
    });

    service.vexpensesApi = {
      getReportExpenses: getReportExpensesMock,
      getTeamMember: getTeamMemberMock,
      getCostCenter: getCostCenterMock,
    };

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const result = await service.processReport(
      9001,
      23575,
      undefined,
      groupedExpenses,
      new Map(),
      new Map(),
      new Map([[10, "6.1.1.01"]]),
      null,
      false,
    );

    expect(result.expensesMissingPayingCompany).toBe(1);
    expect(result.processedExpenses).toBe(0);
    expect(groupedExpenses).toEqual({});
    expect(getCostCenterMock).not.toHaveBeenCalled();
  });

  it("deve ignorar despesa quando cost center não tiver integration_id", async () => {
    const service = new VexpensesApprovedReportsService() as any;
    const getTeamMemberMock = vi.fn().mockResolvedValue({
      integration_id: "F002549",
      parameters: { base: "CIA01" },
    });
    const getCostCenterMock = vi.fn().mockResolvedValue({
      id: 51384,
      integration_id: null,
    });
    const getReportExpensesMock = vi.fn().mockResolvedValue({
      id: 9002,
      user_id: 23575,
      expenses: [makeExpense({ id: 2, userId: 23575, payingCompanyId: 51384 })],
    });

    service.vexpensesApi = {
      getReportExpenses: getReportExpensesMock,
      getTeamMember: getTeamMemberMock,
      getCostCenter: getCostCenterMock,
    };

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const result = await service.processReport(
      9002,
      23575,
      undefined,
      groupedExpenses,
      new Map(),
      new Map(),
      new Map([[10, "6.1.1.01"]]),
      null,
      false,
    );

    expect(result.expensesMissingCostCenterIntegration).toBe(1);
    expect(result.processedExpenses).toBe(0);
    expect(groupedExpenses).toEqual({});
    expect(getCostCenterMock).toHaveBeenCalledWith(51384);
  });

  it("deve ignorar report quando parameters.base estiver ausente", async () => {
    const service = new VexpensesApprovedReportsService() as any;
    const getTeamMemberMock = vi.fn().mockResolvedValue({
      integration_id: "F002549",
      parameters: { base: null },
    });
    const getCostCenterMock = vi.fn();
    const getReportExpensesMock = vi.fn().mockResolvedValue({
      id: 9003,
      user_id: 23575,
      expenses: [makeExpense({ id: 3, userId: 23575, payingCompanyId: 51384 })],
    });

    service.vexpensesApi = {
      getReportExpenses: getReportExpensesMock,
      getTeamMember: getTeamMemberMock,
      getCostCenter: getCostCenterMock,
    };

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const result = await service.processReport(
      9003,
      23575,
      undefined,
      groupedExpenses,
      new Map(),
      new Map(),
      new Map([[10, "6.1.1.01"]]),
      null,
      false,
    );

    expect(result.reportsMissingCodigoCia).toBe(1);
    expect(result.processedExpenses).toBe(0);
    expect(groupedExpenses).toEqual({});
    expect(getCostCenterMock).not.toHaveBeenCalled();
    expect(controleExpenseMock.createMany).toHaveBeenCalledTimes(1);
    expect(controleExpenseMock.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          reportId: 9003,
          status: "DESCARTADO",
          paying_company_id: 51384,
          codigoSapColaborador: "F002549",
        }),
      ],
    });
  });

  it("deve usar user_id do fallback quando payload vier em array sem user_id no topo", async () => {
    const service = new VexpensesApprovedReportsService() as any;
    const getTeamMemberMock = vi.fn().mockResolvedValue({
      integration_id: "F009552",
      parameters: { base: "SBODotzSP" },
    });
    const getCostCenterMock = vi.fn().mockResolvedValue({
      id: 1779737,
      integration_id: "CC-1779737",
    });
    const getReportExpensesMock = vi.fn().mockResolvedValue([
      {
        id: 9346879,
        expenses: {
          data: [
            makeExpense({
              id: 4,
              userId: 971920,
              payingCompanyId: 1779737,
              value: 47.25,
            }),
          ],
        },
      },
    ]);

    service.vexpensesApi = {
      getReportExpenses: getReportExpensesMock,
      getTeamMember: getTeamMemberMock,
      getCostCenter: getCostCenterMock,
    };

    const groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany = {};
    const result = await service.processReport(
      9346879,
      971920,
      undefined,
      groupedExpenses,
      new Map(),
      new Map(),
      new Map([[10, "6.1.1.01"]]),
      null,
      false,
    );

    expect(result.reportsMissingCodigoCia).toBe(0);
    expect(result.processedExpenses).toBe(1);
    expect(getTeamMemberMock).toHaveBeenCalledWith(971920);
  });
});
