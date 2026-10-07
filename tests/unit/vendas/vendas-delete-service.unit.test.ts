import { describe, expect, it, vi, beforeEach } from "vitest";
import { VendasDeleteService } from "../../../src/modules/vendas/services/VendasDeleteService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendaRecDiferida: { findFirst: vi.fn() },
        vendasHeader: { delete: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: vi.fn(),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertVendasHeaderCiaAccess } from "../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess";

describe("VendasDeleteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 400 quando existe receita diferida bloqueante", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 1, ciaIdSAP: 100, status: "PENDENTE" },
            cia: { id: 1 },
        });
        vi.mocked(s4DotzClient.vendaRecDiferida.findFirst).mockResolvedValue({
            id: 5,
            status: "INTEGRADO",
        } as any);

        const service = new VendasDeleteService();

        await expect(service.execute({ id: 1, ciaIds: [1] })).rejects.toMatchObject({
            message: expect.stringContaining("receita diferida"),
            statusCode: 400,
        });

        expect(s4DotzClient.vendasHeader.delete).not.toHaveBeenCalled();
    });

    it("deve excluir venda quando não há diferida bloqueante", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 1, ciaIdSAP: 100, status: "PENDENTE" },
            cia: { id: 1 },
        });
        vi.mocked(s4DotzClient.vendaRecDiferida.findFirst).mockResolvedValue(null);
        vi.mocked(s4DotzClient.vendasHeader.delete).mockResolvedValue({ id: 1 } as any);

        const service = new VendasDeleteService();
        const result = await service.execute({ id: 1, ciaIds: [1] });

        expect(result.message).toContain("removida");
        expect(s4DotzClient.vendasHeader.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
});
