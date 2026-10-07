import { beforeEach, describe, expect, it, vi } from "vitest";

const { controleExpenseMock, $queryRawMock } = vi.hoisted(() => ({
  controleExpenseMock: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $queryRawMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    controleExpense: controleExpenseMock,
    $queryRaw: $queryRawMock,
  },
}));

vi.mock("@/cron/modules/vexpenses/repositories/CiaVexpenseRepository", () => ({
  CiaVexpenseRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/cron/modules/vexpenses/repositories/ConfiguracaoContabilVexpenseRepository", () => ({
  ConfiguracaoContabilVexpenseRepository: vi.fn().mockImplementation(() => ({})),
}));

import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";
import { VexpensesGroupedExpensesByCardCodeAndCompany } from "@/cron/modules/vexpenses/types/expenses.types";

function makeGroupedExpenses(
  cardCode: string,
  reportId: number,
  codigoCia: string,
  accountingAccount = "6.1.1.01",
): VexpensesGroupedExpensesByCardCodeAndCompany {
  return {
    [cardCode]: {
      [accountingAccount]: {
        reportsCount: 1,
        reports: {
          [reportId]: {
            expensesCount: 1,
            expenses: [
              {
                id: 1,
                user_id: 100,
                expense_id: 5001,
                device_id: null,
                integration_id: null,
                external_id: null,
                mileage: "0",
                date: "2026-03-01",
                expense_type_id: 10,
                payment_method_id: null,
                paying_company_id: 55,
                course_id: null,
                reicept_url: null,
                value: 100,
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
                cost_center_integration_id: "CC-55",
                codigo_cia: codigoCia,
                nome_colaborador: "Fulano",
              },
            ],
          },
        },
      },
    },
  };
}

function makeService() {
  const service = new VexpensesApprovedReportsService() as any;
  const resolverCiaIdMock = vi.fn();
  const buscarMock = vi.fn();
  service.ciaVexpenseRepository = { resolverCiaId: resolverCiaIdMock };
  service.configContabilVexpenseRepository = { buscar: buscarMock };
  return { service, resolverCiaIdMock, buscarMock };
}

describe("VexpensesApprovedReportsService.buildIntegrationJson - config contábil VEX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controleExpenseMock.findMany.mockResolvedValue([]);
    controleExpenseMock.createMany.mockResolvedValue({ count: 1 });
    controleExpenseMock.updateMany.mockResolvedValue({ count: 0 });
    controleExpenseMock.findFirst.mockResolvedValue(null);
    $queryRawMock.mockResolvedValue([{ nextVal: 1n }]);
  });

  it("usa tipoArApGl/tipoDocumento/textoDocumento da configuração contábil VEX", async () => {
    const { service, resolverCiaIdMock, buscarMock } = makeService();
    resolverCiaIdMock.mockResolvedValue(42);
    buscarMock.mockResolvedValue({
      tipoArApGl: "GL",
      tipoDocumento: "JE",
      textoDocumento: "Texto do Header VEX",
    });

    const groupedExpenses = makeGroupedExpenses("F001", 9001, "0401");
    const approvalDateByReportId = new Map<number, Date | null>([[9001, null]]);

    const integracoes = await service.buildIntegrationJson(groupedExpenses, approvalDateByReportId);

    expect(integracoes).toHaveLength(1);
    expect(integracoes[0].tipoArApGl).toBe("GL");
    expect(integracoes[0].tipoDocumento).toBe("JE");
    // textoHeaderContabil + reportId (9001), dentro de 25 chars
    expect(integracoes[0].textoDocumento).toBe("Texto do Header VEX9001");
    expect(resolverCiaIdMock).toHaveBeenCalledWith("0401");
    expect(buscarMock).toHaveBeenCalledWith(42);

    // numeroDocumento = "VEX-" + reportId (determinístico)
    expect(integracoes[0].numeroDocumento).toBe("VEX-9001");

    // documento negativo, lançamentos positivos
    expect(integracoes[0].valorDocumento).toBeLessThan(0);
    expect(integracoes[0].lancamentosContabeis[0].valor).toBeGreaterThan(0);
    expect(integracoes[0].valorDocumento).toBe(-integracoes[0].lancamentosContabeis[0].valor);

    // emissão e lançamento = data do sistema (hoje, mesmo formato YYYY-MM-DD); vencimento vazio
    expect(integracoes[0].dataVencimento).toBe("");
    expect(integracoes[0].dataEmissao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(integracoes[0].dataLancamento).toBe(integracoes[0].dataEmissao);
  });

  it("concatena reportId ao textoHeaderContabil e trunca em 25 chars", async () => {
    const { service, resolverCiaIdMock, buscarMock } = makeService();
    resolverCiaIdMock.mockResolvedValue(42);
    buscarMock.mockResolvedValue({
      tipoArApGl: "AP",
      tipoDocumento: "DR",
      textoDocumento: "VExpenses - relatório ",
    });

    const groupedExpenses = makeGroupedExpenses("F001", 12345678, "0401");
    const approvalDateByReportId = new Map<number, Date | null>([[12345678, null]]);

    const integracoes = await service.buildIntegrationJson(groupedExpenses, approvalDateByReportId);

    expect(integracoes).toHaveLength(1);
    // "VExpenses - relatório " (22) + "12345678" = 30 -> truncado em 25
    expect(integracoes[0].textoDocumento).toBe("VExpenses - relatório 123");
    expect(integracoes[0].textoDocumento.length).toBe(25);
  });

  it("descarta report e não gera integração quando resolverCiaId retorna null", async () => {
    const { service, resolverCiaIdMock, buscarMock } = makeService();
    resolverCiaIdMock.mockResolvedValue(null);

    const groupedExpenses = makeGroupedExpenses("F001", 9002, "INVALIDA");
    const approvalDateByReportId = new Map<number, Date | null>([[9002, null]]);

    const integracoes = await service.buildIntegrationJson(groupedExpenses, approvalDateByReportId);

    expect(integracoes).toHaveLength(0);
    expect(buscarMock).not.toHaveBeenCalled();
    expect(controleExpenseMock.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ reportId: 9002, status: "DESCARTADO" }),
        ]),
      }),
    );
  });

  it("descarta report e não gera integração quando buscar retorna null", async () => {
    const { service, resolverCiaIdMock, buscarMock } = makeService();
    resolverCiaIdMock.mockResolvedValue(10);
    buscarMock.mockResolvedValue(null);

    const groupedExpenses = makeGroupedExpenses("F001", 9003, "0401");
    const approvalDateByReportId = new Map<number, Date | null>([[9003, null]]);

    const integracoes = await service.buildIntegrationJson(groupedExpenses, approvalDateByReportId);

    expect(integracoes).toHaveLength(0);
    expect(buscarMock).toHaveBeenCalledWith(10);
    expect(controleExpenseMock.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ reportId: 9003, status: "DESCARTADO" }),
        ]),
      }),
    );
  });
});
