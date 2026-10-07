import { describe, expect, it, vi, beforeEach } from "vitest";

const { buildExecuteMock, sapCreateMock } = vi.hoisted(() => ({
    buildExecuteMock: vi.fn(),
    sapCreateMock: vi.fn(),
}));

vi.mock("../../../src/modules/vendas/utils/BuildSapIntegrationVendas", () => ({
    BuildSapIntegrationVendas: class {
        execute = buildExecuteMock;
    },
}));

vi.mock("../../../src/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry", () => ({
    IntegracaoSapCreateJournalEntryService: class {
        execute = sapCreateMock;
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            update: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { VendasIntegrationRunner } from "../../../src/modules/vendas/utils/integracao/VendasIntegrationRunner";
import { Config } from "../../../src/config/config";

function createMockIntegracaoJson(overrides: Record<string, any> = {}) {
    return {
        tipoArApGl: "AR",
        tipoDocumento: "AR",
        codigoCia: "1000",
        numeroDocumento: "00009826",
        textoDocumento: "Venda de pontos",
        valorDocumento: 1176.00,
        codigoParceiro: "C000001",
        dataEmissao: "2026-02-02",
        dataVencimento: "2026-02-22",
        condicaoPagto: "",
        dataLancamento: "2026-02-02",
        usuarioLancamento: Config.S4_HANA_CLOUD_USER_NAME,
        lancamentosContabeis: [],
        anexos: [],
        ...overrides,
    };
}

describe("VendasIntegrationRunner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
    });

    it("deve retornar sucesso quando SAP responde com 201", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockResolvedValue({
            status: 201,
            data: {
                numeroDocumentoERP: "SAP-001",
                mensagem: "Documento criado com sucesso",
            },
        });

        const runner = new VendasIntegrationRunner();
        const results = await runner.execute({ vendasHeaderId: 1 });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe("sucesso");
        expect(results[0].statusCode).toBe(201);
        expect(results[0].codigoParceiro).toBe("C000001");
        expect(results[0].numeroDocumentoERP).toBe("SAP-001");
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    retornoIntegracaoSap: expect.any(String),
                }),
            }),
        );
    });

    it("deve converter a data de vencimento retornada pelo SAP para Date", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockResolvedValue({
            status: 201,
            data: {
                numeroDocumentoERP: "1800000097",
                mensagem: "Documento criado com sucesso",
                dataVencimento: "/Date(1783036800000)/",
                alertas: [],
            },
        });

        const runner = new VendasIntegrationRunner();
        const results = await runner.execute({ vendasHeaderId: 1 });

        expect(results[0].dataVencimento).toBeInstanceOf(Date);
        expect(results[0].dataVencimento?.toISOString()).toBe(
            "2026-07-03T00:00:00.000Z",
        );
    });

    it("deve retornar conflito quando SAP responde com 409", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockResolvedValue({
            status: 409,
            data: {
                numeroDocumentoERP: "SAP-001",
                mensagem: "Documento já integrado",
            },
        });

        const runner = new VendasIntegrationRunner();
        const results = await runner.execute({ vendasHeaderId: 1 });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe("conflito");
        expect(results[0].statusCode).toBe(409);
    });

    it("deve lançar erro com failFast quando status inesperado", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockResolvedValue({
            status: 500,
            data: { mensagem: "Erro interno SAP" },
        });

        const runner = new VendasIntegrationRunner();

        await expect(
            runner.execute({ vendasHeaderId: 1, failFast: true }),
        ).rejects.toThrow("Erro interno SAP");
    });

    it("deve coletar erro sem lançar quando failFast é false", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockResolvedValue({
            status: 500,
            data: { mensagem: "Erro interno SAP" },
        });

        const runner = new VendasIntegrationRunner();
        const results = await runner.execute({ vendasHeaderId: 1, failFast: false });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe("erro");
        expect(results[0].statusCode).toBe(500);
        expect(results[0].mensagem).toBe("Erro interno SAP");
    });

    it("deve lançar erro com failFast quando API SAP falha com exceção", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockRejectedValue({
            response: { status: 502, data: { mensagem: { erro: "Gateway error" } } },
            message: "Request failed",
        });

        const runner = new VendasIntegrationRunner();

        await expect(
            runner.execute({ vendasHeaderId: 1, failFast: true }),
        ).rejects.toBeDefined();
    });

    it("deve coletar erro de exceção quando failFast é false", async () => {
        const mockJson = createMockIntegracaoJson();
        buildExecuteMock.mockResolvedValue([mockJson]);
        sapCreateMock.mockRejectedValue({
            response: { status: 502, data: { mensagem: { erro: "Gateway error" } } },
            message: "Request failed",
        });

        const runner = new VendasIntegrationRunner();
        const results = await runner.execute({ vendasHeaderId: 1, failFast: false });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe("erro");
        expect(results[0].statusCode).toBe(502);
        expect(results[0].mensagem).toBe("Gateway error");
    });

    it("deve persistir documentoJson e retornoIntegracaoSap quando a montagem do payload falha", async () => {
        buildExecuteMock.mockRejectedValue(
            new Error("Cliente SAP não encontrado na OCRD"),
        );

        const runner = new VendasIntegrationRunner();

        await expect(
            runner.execute({ vendasHeaderId: 1, failFast: true }),
        ).rejects.toThrow("Cliente SAP não encontrado na OCRD");

        expect(sapCreateMock).not.toHaveBeenCalled();
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    documentoJson: expect.stringContaining(
                        "Cliente SAP não encontrado na OCRD",
                    ),
                    retornoIntegracaoSap: expect.stringContaining(
                        "Cliente SAP não encontrado na OCRD",
                    ),
                }),
            }),
        );
    });
});
