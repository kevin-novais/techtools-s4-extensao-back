import { describe, it, expect, vi, beforeEach } from "vitest";

const { ciaFindManyMock, vendasFindManyMock, vendasUpdateMock, publishMock } = vi.hoisted(() => ({
  ciaFindManyMock: vi.fn(),
  vendasFindManyMock: vi.fn(),
  vendasUpdateMock: vi.fn(),
  publishMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    cia: { findMany: ciaFindManyMock },
    vendasHeader: { findMany: vendasFindManyMock, update: vendasUpdateMock },
  },
}));
vi.mock("@/queue/producers/vendasIntegrationProducer", () => ({
  publishIntegrarVendas: publishMock,
}));

import { ReprocessarVendasLoteService } from "@/modules/vendas/services/ReprocessarVendasLoteService";

describe("ReprocessarVendasLoteService", () => {
  beforeEach(() => {
    ciaFindManyMock.mockReset();
    vendasFindManyMock.mockReset();
    vendasUpdateMock.mockReset();
    publishMock.mockReset();
    ciaFindManyMock.mockResolvedValue([{ ciaIdSAP: "0101" }]);
    vendasUpdateMock.mockResolvedValue({});
    publishMock.mockResolvedValue(undefined);
  });

  it("reprocessa só os elegíveis e ignora status não reprocessável", async () => {
    vendasFindManyMock.mockResolvedValue([
      { id: 1, status: "ERRO_INTEG_SAP" },
      { id: 2, status: "CONCLUIDO" },
      { id: 3, status: "PENDENTE" },
    ]);

    const service = new ReprocessarVendasLoteService();
    const result = await service.execute({ ciaIds: [2], ids: [1, 2, 3] });

    expect(publishMock).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(3);
    expect(result.sucesso).toBe(2);
    expect(result.ignorados).toBe(1);
  });

  it("filtra por status e pela CIA do usuário", async () => {
    vendasFindManyMock.mockResolvedValue([{ id: 5, status: "PENDENTE" }]);

    const service = new ReprocessarVendasLoteService();
    const result = await service.execute({ ciaIds: [2], status: "PENDENTE" });

    expect(vendasFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDENTE",
          ciaIdSAP: { in: ["0101"] },
        }),
      }),
    );
    expect(result.sucesso).toBe(1);
  });

  it("reverte o status quando o publish falha e contabiliza erro", async () => {
    vendasFindManyMock.mockResolvedValue([{ id: 7, status: "ERRO_PROC" }]);
    publishMock.mockRejectedValueOnce(new Error("fila fora"));

    const service = new ReprocessarVendasLoteService();
    const result = await service.execute({ ciaIds: [2], ids: [7] });

    expect(result.sucesso).toBe(0);
    expect(result.erros).toEqual([{ id: 7, message: "fila fora" }]);
    expect(vendasUpdateMock).toHaveBeenCalledTimes(2);
  });
});
