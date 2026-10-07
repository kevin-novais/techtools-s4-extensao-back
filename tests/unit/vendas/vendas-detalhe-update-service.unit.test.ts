import { describe, expect, it, vi, beforeEach } from "vitest";
import { VendasDetalheUpdateService } from "../../../src/modules/vendas/services/VendasDetalheUpdateService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasDetalhe: { update: vi.fn(), findFirst: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasDetalheAccess", () => ({
    assertVendasDetalheAccess: vi.fn(),
}));

vi.mock("../../../src/util/date", () => ({
    formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertVendasDetalheAccess } from "../../../src/modules/vendas/utils/assertVendasDetalheAccess";

describe("VendasDetalheUpdateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar quando detalhe não pertence ao header", async () => {
        vi.mocked(assertVendasDetalheAccess).mockRejectedValue(
            new AppError("Detalhe não pertence à venda informada", 400),
        );

        const service = new VendasDetalheUpdateService();

        await expect(
            service.execute({
                vendasHeaderId: 1,
                detalheId: 2,
                data: { codigoProdutoDotz: "P001" },
                ciaIds: [1],
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve lançar 409 quando itemDocumento já existe na venda", async () => {
        vi.mocked(assertVendasDetalheAccess).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
        } as any);
        vi.mocked(s4DotzClient.vendasDetalhe.findFirst).mockResolvedValue({ id: 3 } as any);

        const service = new VendasDetalheUpdateService();

        await expect(
            service.execute({
                vendasHeaderId: 1,
                detalheId: 2,
                data: { itemDocumento: 5 },
                ciaIds: [1],
            }),
        ).rejects.toMatchObject({
            message: "Já existe um detalhe com itemDocumento 5 nesta venda",
            statusCode: 409,
        });
    });

    it("deve atualizar itemDocumento", async () => {
        vi.mocked(assertVendasDetalheAccess).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
        } as any);
        vi.mocked(s4DotzClient.vendasDetalhe.findFirst).mockResolvedValue(null);
        const now = new Date("2026-06-01T12:00:00.000Z");
        vi.mocked(s4DotzClient.vendasDetalhe.update).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
            itemDocumento: 5,
            codigoProdutoDotz: "P001",
            centroLucro: null,
            quantidadePontos: null,
            valorVenda: null,
            precoUnitario: null,
            custoPontos: null,
            criadoEm: now,
            atualizadoEm: now,
        } as any);

        const service = new VendasDetalheUpdateService();
        const result = await service.execute({
            vendasHeaderId: 1,
            detalheId: 2,
            data: { itemDocumento: 5 },
            ciaIds: [1],
        });

        expect(result.itemDocumento).toBe(5);
        expect(s4DotzClient.vendasDetalhe.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ itemDocumento: 5 }),
            }),
        );
    });

    it("deve atualizar detalhe", async () => {
        vi.mocked(assertVendasDetalheAccess).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
        } as any);
        const now = new Date("2026-06-01T12:00:00.000Z");
        vi.mocked(s4DotzClient.vendasDetalhe.update).mockResolvedValue({
            id: 2,
            vendasHeaderId: 1,
            itemDocumento: 1,
            codigoProdutoDotz: "P002",
            centroLucro: null,
            quantidadePontos: 100,
            valorVenda: null,
            precoUnitario: null,
            custoPontos: null,
            criadoEm: now,
            atualizadoEm: now,
        } as any);

        const service = new VendasDetalheUpdateService();
        const result = await service.execute({
            vendasHeaderId: 1,
            detalheId: 2,
            data: { codigoProdutoDotz: "P002" },
            ciaIds: [1],
        });

        expect(result.codigoProdutoDotz).toBe("P002");
        expect(s4DotzClient.vendasDetalhe.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 2 },
                data: expect.objectContaining({ codigoProdutoDotz: "P002" }),
            }),
        );
    });
});
