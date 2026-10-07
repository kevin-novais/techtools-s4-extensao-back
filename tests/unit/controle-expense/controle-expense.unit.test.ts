import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControleExpenseListService } from "../../../src/modules/controle-expense/services/ControleExpenseListService";
import { ControleExpenseShowService } from "../../../src/modules/controle-expense/services/ControleExpenseShowService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        controleExpense: {
            count: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("../../../src/util/date", () => ({
    formatDateOnly: vi.fn((date: Date | null | undefined) =>
        date ? date.toISOString().slice(0, 10) : ""
    ),
    formatDateToBrazilianTimezone: vi.fn((date: Date | null | undefined) =>
        date ? date.toISOString() : ""
    ),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

function makeControleExpense(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        reportId: 101,
        paying_company_id: 55,
        status: "PENDENTE",
        codigoDocumentoERP: null,
        codigoSapColaborador: "C123",
        codigoProtocoloVexpenses: "VEX-42",
        error_message: null,
        dataImportacao: null,
        dataIntegracaoPagamento: null,
        dataAprovacao: new Date("2026-04-01T12:00:00.000Z"),
        criadoEm: new Date("2026-04-01T13:00:00.000Z"),
        atualizadoEm: new Date("2026-04-01T14:00:00.000Z"),
        nomeColaborador: "Fulano de Tal",
        valorDocumento: 123.45,
        ...overrides,
    };
}

describe("ControleExpenseListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve retornar lista paginada com todos os campos formatados", async () => {
        vi.mocked(s4DotzClient.controleExpense.count).mockResolvedValue(5);
        vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([
            makeControleExpense({ status: "ERRO_INTEGRACAO_SAP", error_message: "Falha SAP" }),
            makeControleExpense({ id: 2, reportId: 102, status: "INTEGRADO_SAP" }),
        ] as any);

        const service = new ControleExpenseListService();
        const result = await service.execute({ page: 1, pageSize: 2 });

        expect(result.controleExpenses).toHaveLength(2);
        expect(result.controleExpenses[0]).toMatchObject({
            id: 1,
            reportId: 101,
            paying_company_id: 55,
            status: "ERRO_INTEGRACAO_SAP",
            error_message: "Falha SAP",
            dataAprovacao: "2026-04-01",
            criadoEm: "2026-04-01T13:00:00.000Z",
            nomeColaborador: "Fulano de Tal",
            valorDocumento: 123.45,
        });
        expect(result.pagination).toMatchObject({
            currentPage: 1,
            totalItems: 5,
            totalPages: 3,
            itemsPerPage: 2,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });

    it("deve aplicar filtros por status, reportId, protocolo e documento SAP", async () => {
        vi.mocked(s4DotzClient.controleExpense.count).mockResolvedValue(0);
        vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);

        const service = new ControleExpenseListService();
        await service.execute({
            status: "ERRO_INTEGRACAO_VEXPENSES",
            reportId: 777,
            codigoProtocoloVexpenses: "VEX-777",
            codigoDocumentoERP: "DOC777",
        });

        expect(s4DotzClient.controleExpense.count).toHaveBeenCalledWith({
            where: {
                status: "ERRO_INTEGRACAO_VEXPENSES",
                reportId: 777,
                codigoProtocoloVexpenses: { contains: "VEX-777" },
                codigoDocumentoERP: { contains: "DOC777" },
            },
        });
    });

    it("deve aplicar filtros de periodo em dataAprovacao e dataImportacao", async () => {
        const dataAprovacaoInicio = new Date("2026-04-01T00:00:00.000Z");
        const dataAprovacaoFim = new Date("2026-04-10T23:59:59.999Z");
        const dataImportacaoInicio = new Date("2026-04-11T00:00:00.000Z");
        const dataImportacaoFim = new Date("2026-04-12T23:59:59.999Z");

        vi.mocked(s4DotzClient.controleExpense.count).mockResolvedValue(0);
        vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);

        const service = new ControleExpenseListService();
        await service.execute({
            dataAprovacaoInicio,
            dataAprovacaoFim,
            dataImportacaoInicio,
            dataImportacaoFim,
        });

        expect(s4DotzClient.controleExpense.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    dataAprovacao: {
                        gte: dataAprovacaoInicio,
                        lte: dataAprovacaoFim,
                    },
                    dataImportacao: {
                        gte: dataImportacaoInicio,
                        lte: dataImportacaoFim,
                    },
                },
            })
        );
    });

    it("deve enviar skip e take conforme paginação", async () => {
        vi.mocked(s4DotzClient.controleExpense.count).mockResolvedValue(20);
        vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);

        const service = new ControleExpenseListService();
        await service.execute({ page: 3, pageSize: 5 });

        expect(s4DotzClient.controleExpense.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 10,
                take: 5,
                orderBy: { id: "desc" },
            })
        );
    });

    it("deve aplicar filtros e ordenação enviados pelo AG Grid", async () => {
        vi.mocked(s4DotzClient.controleExpense.count).mockResolvedValue(0);
        vi.mocked(s4DotzClient.controleExpense.findMany).mockResolvedValue([]);

        const service = new ControleExpenseListService();
        await service.execute({
            filterModel: JSON.stringify({
                codigoProtocoloVexpenses: {
                    filterType: "text",
                    type: "contains",
                    filter: "VEX",
                },
            }),
            sortModel: JSON.stringify([{ colId: "reportId", sort: "asc" }]),
        });

        expect(s4DotzClient.controleExpense.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    AND: [
                        {
                            codigoProtocoloVexpenses: { contains: "VEX" },
                        },
                    ],
                },
                orderBy: [{ reportId: "asc" }],
            })
        );
    });
});

describe("ControleExpenseShowService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando controle não for encontrado", async () => {
        vi.mocked(s4DotzClient.controleExpense.findUnique).mockResolvedValue(null);

        const service = new ControleExpenseShowService();
        const promise = service.execute({ id: 999 });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Controle de despesa não encontrado",
            statusCode: 404,
        });
    });

    it("deve retornar detalhe completo formatado quando encontrado", async () => {
        vi.mocked(s4DotzClient.controleExpense.findUnique).mockResolvedValue(
            makeControleExpense({
                id: 10,
                reportId: 900,
                status: "INTEGRADO_VEXPENSES",
                codigoDocumentoERP: "SAP900",
                dataImportacao: new Date("2026-04-02T12:00:00.000Z"),
                dataIntegracaoPagamento: new Date("2026-04-03T12:00:00.000Z"),
            }) as any
        );

        const service = new ControleExpenseShowService();
        const result = await service.execute({ id: 10 });

        expect(result).toMatchObject({
            id: 10,
            reportId: 900,
            status: "INTEGRADO_VEXPENSES",
            codigoDocumentoERP: "SAP900",
            dataImportacao: "2026-04-02T12:00:00.000Z",
            dataIntegracaoPagamento: "2026-04-03T12:00:00.000Z",
        });
        expect(s4DotzClient.controleExpense.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 10 },
            })
        );
    });
});
