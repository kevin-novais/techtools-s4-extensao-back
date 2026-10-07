import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    controleExpense: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  },
}));

import s4DotzClient from "@/database/clients/s4DotzClient";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

const baseParams = {
  reportId: 10,
  cardCode: "C1",
  payingCompanyIds: [55],
  protocolo: "VEX-5",
  approvalDate: null,
  nomeColaborador: "Fulano",
  valorDocumento: 123.45,
  codigoCia: "0101",
  fiscalYear: "2026",
};

describe("VexpensesApprovedReportsService.saveControleExpense (upsert)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria linha nova com nome e valor quando nao existe", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);
    vi.mocked(s4DotzClient.controleExpense.createMany).mockResolvedValue({ count: 1 } as any);

    const service = new VexpensesApprovedReportsService();
    const ok = await (service as any).saveControleExpense(baseParams);

    expect(ok).toBe(true);
    expect(s4DotzClient.controleExpense.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          reportId: 10,
          paying_company_id: 55,
          status: "PENDENTE",
          codigoSapColaborador: "C1",
          codigoProtocoloVexpenses: "VEX-5",
          nomeColaborador: "Fulano",
          valorDocumento: 123.45,
          codigoCia: "0101",
          fiscalYear: "2026",
        }),
      ],
    });
  });

  it("atualiza linha reprocessavel (reset PENDENTE, limpa erro)", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([
      { id: 7, paying_company_id: 55, status: "DESCARTADO" },
    ] as any);

    const service = new VexpensesApprovedReportsService();
    await (service as any).saveControleExpense(baseParams);

    expect(s4DotzClient.controleExpense.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        status: "PENDENTE",
        codigoProtocoloVexpenses: "VEX-5",
        nomeColaborador: "Fulano",
        valorDocumento: 123.45,
        codigoCia: "0101",
        fiscalYear: "2026",
        error_message: null,
      }),
    });
    expect(s4DotzClient.controleExpense.createMany).not.toHaveBeenCalled();
  });

  it("nao toca linha ja integrada", async () => {
    vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([
      { id: 8, paying_company_id: 55, status: "INTEGRADO_SAP" },
    ] as any);

    const service = new VexpensesApprovedReportsService();
    await (service as any).saveControleExpense(baseParams);

    expect(s4DotzClient.controleExpense.update).not.toHaveBeenCalled();
    expect(s4DotzClient.controleExpense.createMany).not.toHaveBeenCalled();
  });
});
