import { beforeEach, describe, expect, it, vi } from "vitest";
import { FluxoCaixaCiaParceiroListService } from "../../../src/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroListService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        fluxoCaixaCiaParceiro: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("FluxoCaixaCiaParceiroListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("aplica merge entre cardCode + filterModel e sortModel do agGrid", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.count).mockResolvedValue(12 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.findMany).mockResolvedValue([
            {
                cardCode: "V100",
                companyCode: "1000",
                itemFluxoCaixa: "001",
                criadoEm: new Date("2026-01-01T00:00:00.000Z"),
                atualizadoEm: new Date("2026-01-01T00:00:00.000Z"),
                criadoPor: 1,
                atualizadoPor: 1,
            },
        ] as never);

        const service = new FluxoCaixaCiaParceiroListService();

        const result = await service.execute({
            cardCode: " V100 ",
            page: 2,
            limit: 5,
            filterModel: JSON.stringify({
                companyCode: { filterType: "text", type: "contains", filter: "1000" },
            }),
            sortModel: JSON.stringify([{ colId: "itemFluxoCaixa", sort: "desc" }]),
        });

        expect(s4DotzClient.fluxoCaixaCiaParceiro.count).toHaveBeenCalledWith({
            where: {
                AND: [
                    { cardCode: "V100" },
                    {
                        AND: [{ companyCode: { contains: "1000" } }],
                    },
                ],
            },
        });
        expect(s4DotzClient.fluxoCaixaCiaParceiro.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 5,
                take: 5,
                orderBy: [{ itemFluxoCaixa: "desc" }],
            }),
        );
        expect(result.pagination).toMatchObject({
            currentPage: 2,
            totalPages: 3,
            totalItems: 12,
            hasNextPage: true,
            hasPreviousPage: true,
        });
    });

    it("mantém ordenação padrão estável quando sortModel não é informado", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.count).mockResolvedValue(0 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaParceiroListService();
        await service.execute({ cardCode: "V100" });

        expect(s4DotzClient.fluxoCaixaCiaParceiro.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ companyCode: "asc" }, { itemFluxoCaixa: "asc" }],
            }),
        );
    });

    it("ignora filtros agGrid fora da allowlist", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.count).mockResolvedValue(0 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaParceiroListService();
        await service.execute({
            cardCode: "V100",
            filterModel: JSON.stringify({
                campoInvalido: { filterType: "text", type: "contains", filter: "abc" },
            }),
        });

        expect(s4DotzClient.fluxoCaixaCiaParceiro.count).toHaveBeenCalledWith({
            where: { cardCode: "V100" },
        });
    });

    it("retorna listagem global quando cardCode não é informado", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.count).mockResolvedValue(3 as never);
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.findMany).mockResolvedValue([] as never);

        const service = new FluxoCaixaCiaParceiroListService();
        await service.execute({
            page: 1,
            limit: 10,
        });

        expect(s4DotzClient.fluxoCaixaCiaParceiro.count).toHaveBeenCalledWith({
            where: {},
        });
    });
});
