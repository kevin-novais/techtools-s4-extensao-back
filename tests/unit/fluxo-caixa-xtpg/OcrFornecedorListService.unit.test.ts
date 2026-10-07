import { beforeEach, describe, expect, it, vi } from "vitest";
import { OcrFornecedorListService } from "../../../src/modules/fluxo-caixa-xtpg/services/OcrFornecedorListService";

const { getDotzStageClientMock } = vi.hoisted(() => ({
    getDotzStageClientMock: vi.fn(),
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: getDotzStageClientMock,
}));

describe("OcrFornecedorListService", () => {
    const countMock = vi.fn();
    const findManyMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        getDotzStageClientMock.mockReturnValue({
            oCRD: {
                count: countMock,
                findMany: findManyMock,
            },
        });
    });

    it("aplica regras base de ativo/search com merge de filterModel e sortModel", async () => {
        countMock.mockResolvedValue(7);
        findManyMock.mockResolvedValue([
            {
                CardCode: "V100",
                U_CODDOTZ: 10,
                CardName: "Fornecedor A",
                cnpj: "12345678000190",
            },
        ]);

        const service = new OcrFornecedorListService();
        const result = await service.execute({
            page: 1,
            limit: 5,
            search: "12.345.678/0001-90",
            filterModel: JSON.stringify({
                cardName: { filterType: "text", type: "contains", filter: "Fornecedor" },
            }),
            sortModel: JSON.stringify([{ colId: "cardName", sort: "asc" }]),
        });

        expect(countMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.any(Array),
                }),
            }),
        );
        const whereArg = countMock.mock.calls[0][0].where;
        expect(whereArg.AND[0]).toMatchObject({
            ativo: true,
            OR: [
                { CardCode: { contains: "12.345.678/0001-90" } },
                { CardName: { contains: "12.345.678/0001-90" } },
                { cnpj: { contains: "12345678000190" } },
            ],
        });
        expect(whereArg.AND[1]).toMatchObject({
            AND: [{ CardName: { contains: "Fornecedor" } }],
        });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ CardName: "asc" }],
            }),
        );
        expect(result.pagination).toMatchObject({
            currentPage: 1,
            totalPages: 2,
            totalItems: 7,
            hasNextPage: true,
            hasPreviousPage: false,
        });
        expect(result.fornecedores[0]).toMatchObject({
            CardCode: "V100",
            U_CODDOTZ: 10,
            CardName: "Fornecedor A",
            cnpj: "12345678000190",
        });
    });

    it("mantém ordenação padrão por CardCode quando não há sortModel", async () => {
        countMock.mockResolvedValue(0);
        findManyMock.mockResolvedValue([]);

        const service = new OcrFornecedorListService();
        await service.execute({ search: "abc" });

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { CardCode: "asc" },
            }),
        );
    });

    it("ignora sortModel com colunas fora da allowlist", async () => {
        countMock.mockResolvedValue(0);
        findManyMock.mockResolvedValue([]);

        const service = new OcrFornecedorListService();
        await service.execute({
            sortModel: JSON.stringify([{ colId: "campoInvalido", sort: "desc" }]),
        });

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { CardCode: "asc" },
            }),
        );
    });
});
