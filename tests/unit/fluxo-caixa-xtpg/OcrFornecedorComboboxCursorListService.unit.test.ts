import { beforeEach, describe, expect, it, vi } from "vitest";
import { OcrFornecedorComboboxCursorListService } from "../../../src/modules/fluxo-caixa-xtpg/services/OcrFornecedorComboboxCursorListService";

const { getDotzStageClientMock } = vi.hoisted(() => ({
    getDotzStageClientMock: vi.fn(),
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: getDotzStageClientMock,
}));

describe("OcrFornecedorComboboxCursorListService", () => {
    const findManyMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        getDotzStageClientMock.mockReturnValue({
            oCRD: {
                findMany: findManyMock,
            },
        });
    });

    it("retorna nextCursor quando ha proxima pagina", async () => {
        findManyMock.mockResolvedValue([
            { CardCode: "A001", CardName: "Fornecedor A", cnpj: "111", U_CODDOTZ: 1 },
            { CardCode: "A002", CardName: "Fornecedor B", cnpj: "222", U_CODDOTZ: 2 },
            { CardCode: "A003", CardName: "Fornecedor C", cnpj: "333", U_CODDOTZ: 3 },
        ]);

        const service = new OcrFornecedorComboboxCursorListService();
        const result = await service.execute({ limit: 2 });

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 3,
                skip: 0,
                orderBy: { CardCode: "asc" },
            }),
        );
        expect(result.fornecedores).toHaveLength(2);
        expect(result.pagination).toEqual({
            nextCursor: "A002",
            hasNextPage: true,
        });
    });

    it("usa cursor corretamente no findMany", async () => {
        findManyMock.mockResolvedValue([
            { CardCode: "A003", CardName: "Fornecedor C", cnpj: "333", U_CODDOTZ: 3 },
        ]);

        const service = new OcrFornecedorComboboxCursorListService();
        await service.execute({ cursor: "A002", limit: 2 });

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 1,
                cursor: { CardCode: "A002" },
            }),
        );
    });

    it("aplica search em cardCode/cardName/cnpj e monta label", async () => {
        findManyMock.mockResolvedValue([
            { CardCode: "B001", CardName: "Fornecedor XPTO", cnpj: "12345678000190", U_CODDOTZ: null },
        ]);

        const service = new OcrFornecedorComboboxCursorListService();
        const result = await service.execute({ search: "12.345.678/0001-90" });

        const whereArg = findManyMock.mock.calls[0][0].where;
        expect(whereArg).toMatchObject({
            ativo: true,
            OR: [
                { CardCode: { contains: "12.345.678/0001-90" } },
                { CardName: { contains: "12.345.678/0001-90" } },
                { cnpj: { contains: "12345678000190" } },
            ],
        });
        expect(result.fornecedores[0]).toMatchObject({
            cardCode: "B001",
            label: "B001 - Fornecedor XPTO",
        });
    });
});
