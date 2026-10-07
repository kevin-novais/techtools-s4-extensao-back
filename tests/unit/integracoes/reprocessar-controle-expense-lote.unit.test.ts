import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyMock, reprocessReportMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  reprocessReportMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { controleExpense: { findMany: findManyMock } },
}));
vi.mock("@/cron/modules/vexpenses/services/VexpensesApprovedReportsService", () => ({
  VexpensesApprovedReportsService: vi.fn().mockImplementation(() => ({
    reprocessReport: reprocessReportMock,
  })),
}));

import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";
import { ReprocessarControleExpenseLoteService } from "@/modules/controle-expense/services/ReprocessarControleExpenseLoteService";

describe("ReprocessarControleExpenseLoteService", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    reprocessReportMock.mockReset();
    vi.mocked(VexpensesApprovedReportsService).mockImplementation(
      () => ({ reprocessReport: reprocessReportMock }) as any,
    );
  });

  it("reprocessa só os elegíveis e ignora status não reprocessável", async () => {
    findManyMock.mockResolvedValue([
      { id: 1, reportId: 101, status: "ERRO_INTEGRACAO_SAP" },
      { id: 2, reportId: 102, status: "INTEGRADO_VEXPENSES" },
      { id: 3, reportId: 103, status: "PENDENTE" },
    ]);
    const service = new ReprocessarControleExpenseLoteService();
    const result = await service.execute({ ids: [1, 2, 3] });

    expect(reprocessReportMock).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(3);
    expect(result.sucesso).toBe(2);
    expect(result.ignorados).toBe(1);
  });

  it("aceita filtro por status", async () => {
    findManyMock.mockResolvedValue([{ id: 5, reportId: 105, status: "PENDENTE" }]);
    const service = new ReprocessarControleExpenseLoteService();
    const result = await service.execute({ status: "PENDENTE" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "PENDENTE" }) }),
    );
    expect(result.sucesso).toBe(1);
  });
});
