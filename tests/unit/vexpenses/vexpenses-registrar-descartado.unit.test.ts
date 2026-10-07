import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    controleExpense: { findMany: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
  },
}));

import s4DotzClient from "@/database/clients/s4DotzClient";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

describe("VexpensesApprovedReportsService.registrarReportDescartado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refresca nome, cardCode e valor ao atualizar linha descartada existente", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([
      { id: 1, status: "DESCARTADO" },
    ] as any);

    const service = new VexpensesApprovedReportsService();
    await (service as any).registrarReportDescartado(10, "motivo novo", {
      cardCode: "C1",
      nomeColaborador: "Fulano",
      valorDocumento: 50.5,
    });

    expect(s4DotzClient.controleExpense.updateMany).toHaveBeenCalledWith({
      where: { reportId: 10, status: "DESCARTADO" },
      data: expect.objectContaining({
        error_message: "motivo novo",
        codigoSapColaborador: "C1",
        nomeColaborador: "Fulano",
        valorDocumento: 50.5,
      }),
    });
    expect(s4DotzClient.controleExpense.createMany).not.toHaveBeenCalled();
  });

  it("grava valor ao criar linha de descarte nova", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);

    const service = new VexpensesApprovedReportsService();
    await (service as any).registrarReportDescartado(10, "sem cia", {
      cardCode: "C1",
      nomeColaborador: "Fulano",
      valorDocumento: 50.5,
      payingCompanyIds: [55],
    });

    expect(s4DotzClient.controleExpense.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          reportId: 10,
          paying_company_id: 55,
          status: "DESCARTADO",
          nomeColaborador: "Fulano",
          valorDocumento: 50.5,
        }),
      ],
    });
  });

  it("nao atualiza quando ha linha nao descartada", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([
      { id: 1, status: "PENDENTE" },
    ] as any);

    const service = new VexpensesApprovedReportsService();
    await (service as any).registrarReportDescartado(10, "motivo", { nomeColaborador: "Fulano" });

    expect(s4DotzClient.controleExpense.updateMany).not.toHaveBeenCalled();
    expect(s4DotzClient.controleExpense.createMany).not.toHaveBeenCalled();
  });
});
