import { beforeEach, describe, expect, it, vi } from "vitest";
import { FluxoCaixaCiaTipoLancamentoListService } from "../../../src/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoListService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        fluxoCaixaCiaTipoLancamento: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("FluxoCaixaCiaTipoLancamentoListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("mantém ordenação default quando sortModel não é informado", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).mockResolvedValue(1 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).mockResolvedValue([
            {
                companyCode: "1000",
                postingKey: "31",
                documentType: "KR",
                referenceDocumentType: "",
                isReversed: "",
                reversalReason: "",
                debitCreditCode: "H",
                itemFluxoCaixa: "123",
                criadoEm: new Date("2026-01-01T00:00:00.000Z"),
                atualizadoEm: new Date("2026-01-01T00:00:00.000Z"),
                criadoPor: 1,
                atualizadoPor: 1,
            },
        ] as never);

        const service = new FluxoCaixaCiaTipoLancamentoListService();
        await service.execute({ companyCode: "1000", postingKey: "3", documentType: "K" });

        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [
                    { companyCode: "asc" },
                    { postingKey: "asc" },
                    { documentType: "asc" },
                ],
            }),
        );
    });

    it("aplica merge de filtros e ordenação do agGrid", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).mockResolvedValue(11 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaTipoLancamentoListService();
        const result = await service.execute({
            companyCode: "1000",
            page: 2,
            limit: 5,
            filterModel: JSON.stringify({
                debitCreditCode: { filterType: "text", type: "equals", filter: "H" },
            }),
            sortModel: JSON.stringify([{ colId: "itemFluxoCaixa", sort: "desc" }]),
        });

        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).toHaveBeenCalledWith({
            where: {
                AND: [
                    { companyCode: "1000" },
                    { AND: [{ debitCreditCode: { equals: "H" } }] },
                ],
            },
        });
        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 5,
                take: 5,
                orderBy: [{ itemFluxoCaixa: "desc" }],
            }),
        );
        expect(result.pagination).toMatchObject({
            currentPage: 2,
            totalPages: 3,
            totalItems: 11,
            hasNextPage: true,
            hasPreviousPage: true,
        });
    });

    it("ignora filtro de companyCode quando valor vem em branco", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).mockResolvedValue(0 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaTipoLancamentoListService();
        await service.execute({ companyCode: "   " });

        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).toHaveBeenCalledWith({
            where: {},
        });
    });

    it("ignora filtros/sorts fora da allowlist", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).mockResolvedValue(0 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaTipoLancamentoListService();
        await service.execute({
            filterModel: JSON.stringify({
                campoInvalido: { filterType: "text", type: "contains", filter: "x" },
            }),
            sortModel: JSON.stringify([{ colId: "outroInvalido", sort: "desc" }]),
        });

        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.count).toHaveBeenCalledWith({
            where: {},
        });
        expect(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [
                    { companyCode: "asc" },
                    { postingKey: "asc" },
                    { documentType: "asc" },
                ],
            }),
        );
    });
});
