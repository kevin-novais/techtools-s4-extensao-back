import { describe, expect, it, vi, beforeEach } from "vitest";
import { VendasDetalheDeleteService } from "../../../src/modules/vendas/services/VendasDetalheDeleteService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasDetalhe: { delete: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasDetalheAccess", () => ({
    assertVendasDetalheAccess: vi.fn(),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertVendasDetalheAccess } from "../../../src/modules/vendas/utils/assertVendasDetalheAccess";

describe("VendasDetalheDeleteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar 404 quando detalhe não existe", async () => {
        vi.mocked(assertVendasDetalheAccess).mockRejectedValue(
            new AppError("Detalhe da venda não encontrado", 404),
        );

        const service = new VendasDetalheDeleteService();

        await expect(
            service.execute({ vendasHeaderId: 1, detalheId: 99, ciaIds: [1] }),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve excluir detalhe", async () => {
        vi.mocked(assertVendasDetalheAccess).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
        } as any);
        vi.mocked(s4DotzClient.vendasDetalhe.delete).mockResolvedValue({ id: 2 } as any);

        const service = new VendasDetalheDeleteService();
        const result = await service.execute({
            vendasHeaderId: 1,
            detalheId: 2,
            ciaIds: [1],
        });

        expect(result.message).toContain("removido");
        expect(s4DotzClient.vendasDetalhe.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    });
});
