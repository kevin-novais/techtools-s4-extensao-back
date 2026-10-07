import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
  default: { controleExpense: { findUnique: vi.fn() } },
}));

const reprocessReport = vi.fn();
vi.mock("../../../src/cron/modules/vexpenses/services/VexpensesApprovedReportsService", () => ({
  VexpensesApprovedReportsService: vi.fn().mockImplementation(() => ({ reprocessReport })),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import AppError from "../../../src/util/AppError";
import { VexpensesApprovedReportsService } from "../../../src/cron/modules/vexpenses/services/VexpensesApprovedReportsService";
import { ReprocessarControleExpenseService } from "../../../src/modules/controle-expense/services/ReprocessarControleExpenseService";

describe("ReprocessarControleExpenseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(VexpensesApprovedReportsService).mockImplementation(() => ({ reprocessReport }) as any);
  });

  it("404 quando controle nao existe", async () => {
    vi.mocked(s4DotzClient.controleExpense.findUnique).mockResolvedValue(null);
    const service = new ReprocessarControleExpenseService();
    await expect(service.execute({ id: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409 quando status nao e reprocessavel", async () => {
    vi.mocked(s4DotzClient.controleExpense.findUnique).mockResolvedValue({
      id: 1, reportId: 10, status: "INTEGRADO_SAP",
    } as any);
    const service = new ReprocessarControleExpenseService();
    await expect(service.execute({ id: 1 })).rejects.toMatchObject({ statusCode: 409 });
    expect(reprocessReport).not.toHaveBeenCalled();
  });

  it("dispara reprocessReport para status reprocessavel", async () => {
    vi.mocked(s4DotzClient.controleExpense.findUnique).mockResolvedValue({
      id: 1, reportId: 10, status: "ERRO_INTEGRACAO_SAP",
    } as any);
    const service = new ReprocessarControleExpenseService();
    const result = await service.execute({ id: 1 });
    expect(reprocessReport).toHaveBeenCalledWith(10);
    expect(result).toEqual({ reportId: 10 });
  });
});
