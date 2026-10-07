import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindUniqueVenda,
    mockFindFirstCia,
    mockCount,
    mockFindMany,
} = vi.hoisted(() => ({
    mockFindUniqueVenda: vi.fn(),
    mockFindFirstCia: vi.fn(),
    mockCount: vi.fn(),
    mockFindMany: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { findUnique: mockFindUniqueVenda },
        cia: { findFirst: mockFindFirstCia },
        vendaRecDiferida: {
            count: mockCount,
            findMany: mockFindMany,
        },
    },
}));

vi.mock("../../../src/util/date", () => ({
    formatDateOnly: vi.fn((d: Date | null) => (d ? d.toISOString().split("T")[0] : null)),
    formatDateToBrazilianTimezone: vi.fn((d: Date) => d.toISOString()),
}));

import { VendaRecDiferidaListService } from "../../../src/modules/vendas/services/VendaRecDiferidaListService";

const now = new Date("2026-03-01T10:00:00.000Z");

const baseParcela = {
    id: 1,
    vendasHeaderId: 10,
    periodoDiferimento: 1,
    tipo: "DIFERIDO_TOTAL",
    status: "INTEGRADO",
    ano: 2026,
    dataEmissao: new Date("2026-01-15T00:00:00.000Z"),
    dataDiferimento: new Date("2026-02-01T00:00:00.000Z"),
    valorDiferimento: { toString: () => "100.00" },
    tipoContabilErp: "GL",
    tipoDocumentoErp: "RD",
    contaCredito: "4000001",
    contaDebito: "1000001",
    centroLucro: "LP01",
    centroCusto: null,
    anoFiscalLancamento: 2026,
    dataIntegracao: new Date("2026-02-01T00:00:00.000Z"),
    codigoDocumentoErp: "4900000001",
    codigoDocumentoErpReversao: null,
    dataDoLancamentoDaReversao: null,
    anoReversao: null,
    criadoEm: now,
    atualizadoEm: now,
};

describe("VendaRecDiferidaListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 403 quando ciaIds está vazio", async () => {
        const service = new VendaRecDiferidaListService();
        await expect(
            service.execute({ vendasHeaderId: 1, ciaIds: [] }),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        mockFindUniqueVenda.mockResolvedValue(null);

        const service = new VendaRecDiferidaListService();
        await expect(
            service.execute({ vendasHeaderId: 999, ciaIds: [1] }),
        ).rejects.toMatchObject({ message: "Venda não encontrada", statusCode: 404 });
    });

    it("deve lançar AppError 403 quando CIA não encontrada", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue(null);

        const service = new VendaRecDiferidaListService();
        await expect(
            service.execute({ vendasHeaderId: 1, ciaIds: [1] }),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 403 quando CIA encontrada mas não está nos ciaIds do usuário", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue({ id: 99 }); // id 99, usuário só tem acesso ao id 1

        const service = new VendaRecDiferidaListService();
        await expect(
            service.execute({ vendasHeaderId: 1, ciaIds: [1] }),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve retornar lista paginada com parcelas e metadados de paginação corretos", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue({ id: 1 });
        mockCount.mockResolvedValue(3);
        mockFindMany.mockResolvedValue([baseParcela]);

        const service = new VendaRecDiferidaListService();
        const result = await service.execute({ vendasHeaderId: 10, ciaIds: [1], page: 1, limit: 2 });

        expect(result.parcelas).toHaveLength(1);
        expect(result.parcelas[0].id).toBe(1);
        expect(result.parcelas[0].tipo).toBe("DIFERIDO_TOTAL");
        expect(result.parcelas[0].status).toBe("INTEGRADO");
        expect(result.parcelas[0].codigoDocumentoErp).toBe("4900000001");

        expect(result.pagination.currentPage).toBe(1);
        expect(result.pagination.totalItems).toBe(3);
        expect(result.pagination.totalPages).toBe(2);
        expect(result.pagination.itemsPerPage).toBe(2);
        expect(result.pagination.hasNextPage).toBe(true);
        expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it("deve retornar lista vazia quando não há parcelas", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue({ id: 1 });
        mockCount.mockResolvedValue(0);
        mockFindMany.mockResolvedValue([]);

        const service = new VendaRecDiferidaListService();
        const result = await service.execute({ vendasHeaderId: 10, ciaIds: [1] });

        expect(result.parcelas).toHaveLength(0);
        expect(result.pagination.totalItems).toBe(0);
        expect(result.pagination.totalPages).toBe(0);
        expect(result.pagination.hasNextPage).toBe(false);
    });

    it("deve passar filtro de status para a query quando fornecido", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue({ id: 1 });
        mockCount.mockResolvedValue(1);
        mockFindMany.mockResolvedValue([baseParcela]);

        const service = new VendaRecDiferidaListService();
        await service.execute({ vendasHeaderId: 10, ciaIds: [1], status: "INTEGRADO" as any });

        expect(mockCount).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ status: "INTEGRADO" }) }),
        );
        expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ status: "INTEGRADO" }) }),
        );
    });

    it("deve calcular hasPreviousPage corretamente em páginas intermediárias", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ciaId: 1000 });
        mockFindFirstCia.mockResolvedValue({ id: 1 });
        mockCount.mockResolvedValue(10);
        mockFindMany.mockResolvedValue([baseParcela]);

        const service = new VendaRecDiferidaListService();
        const result = await service.execute({ vendasHeaderId: 10, ciaIds: [1], page: 2, limit: 3 });

        expect(result.pagination.hasPreviousPage).toBe(true);
        expect(result.pagination.hasNextPage).toBe(true);
        expect(result.pagination.currentPage).toBe(2);
    });
});
