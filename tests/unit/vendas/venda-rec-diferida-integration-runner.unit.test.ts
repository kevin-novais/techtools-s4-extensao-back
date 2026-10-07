import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockBuildExecute, mockSapCreate, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
    mockBuildExecute: vi.fn(),
    mockSapCreate: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
}));

vi.mock("../../../src/modules/vendas/utils/BuildSapIntegrationVendaRecDiferida", () => ({
    BuildSapIntegrationVendaRecDiferida: class {
        execute = mockBuildExecute;
    },
}));

vi.mock("../../../src/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry", () => ({
    IntegracaoSapCreateJournalEntryService: class {
        execute = mockSapCreate;
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendaRecDiferida: {
            findUnique: mockFindUnique,
            update: mockUpdate,
        },
    },
}));

import { VendaRecDiferidaIntegrationRunner } from "../../../src/modules/vendas/utils/integracao/VendaRecDiferidaIntegrationRunner";
import { Config } from "../../../src/config/config";

const baseParcela = {
    id: 1,
    status: "PENDENTE",
    dataDiferimento: new Date("2026-02-01T00:00:00.000Z"),
    vendasHeaderId: 10,
};

const baseIntegracaoJson = {
    tipoArApGl: "GL",
    tipoDocumento: "RD",
    codigoCia: "1000",
    numeroDocumento: "RD-10-01",
    textoDocumento: "Receita diferida",
    valorDocumento: 100,
    codigoParceiro: "C000001",
    dataEmissao: "2026-02-01",
    dataVencimento: "2026-02-01",
    condicaoPagto: "",
    dataLancamento: "2026-02-01",
    usuarioLancamento: Config.S4_HANA_CLOUD_USER_NAME,
    lancamentosContabeis: [],
    anexos: [],
};

describe("VendaRecDiferidaIntegrationRunner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve retornar conflito e não chamar SAP quando parcela já está INTEGRADA", async () => {
        mockFindUnique.mockResolvedValue({ ...baseParcela, status: "INTEGRADO" });

        const runner = new VendaRecDiferidaIntegrationRunner();
        const result = await runner.execute({ vendaRecDiferidaId: 1 });

        expect(result.status).toBe("conflito");
        expect(result.statusCode).toBe(409);
        expect(mockSapCreate).not.toHaveBeenCalled();
    });

    it("deve retornar erro 404 quando parcela não encontrada", async () => {
        mockFindUnique.mockResolvedValue(null);

        const runner = new VendaRecDiferidaIntegrationRunner();
        const result = await runner.execute({ vendaRecDiferidaId: 999 });

        expect(result.status).toBe("erro");
        expect(result.statusCode).toBe(404);
    });

    it("deve integrar e atualizar status para INTEGRADO quando SAP responde 201", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockBuildExecute.mockResolvedValue(baseIntegracaoJson);
        mockSapCreate.mockResolvedValue({
            status: 201,
            data: { numeroDocumentoERP: "4900000001", mensagem: "Criado com sucesso" },
        });
        mockUpdate.mockResolvedValue({});

        const runner = new VendaRecDiferidaIntegrationRunner();
        const result = await runner.execute({ vendaRecDiferidaId: 1 });

        expect(result.status).toBe("sucesso");
        expect(result.statusCode).toBe(201);
        expect(result.codigoDocumentoErp).toBe("4900000001");
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                requestSap: JSON.stringify(baseIntegracaoJson),
                responseSap: null,
                dataIntegracao: expect.any(Date),
            },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: "INTEGRADO",
                    codigoDocumentoErp: "4900000001",
                    responseSap: JSON.stringify({ numeroDocumentoERP: "4900000001", mensagem: "Criado com sucesso" }),
                }),
            }),
        );
    });

    it("deve tratar SAP 409 como INTEGRADO (conflito idempotente)", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockBuildExecute.mockResolvedValue(baseIntegracaoJson);
        mockSapCreate.mockResolvedValue({
            status: 409,
            data: { numeroDocumentoERP: "4900000001", mensagem: "Já integrado" },
        });
        mockUpdate.mockResolvedValue({});

        const runner = new VendaRecDiferidaIntegrationRunner();
        const result = await runner.execute({ vendaRecDiferidaId: 1 });

        expect(result.status).toBe("conflito");
        expect(result.statusCode).toBe(409);
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "INTEGRADO" }) }),
        );
    });

    it("deve marcar ERRO_INTEG e relançar quando SAP lança exceção", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockBuildExecute.mockResolvedValue(baseIntegracaoJson);
        mockSapCreate.mockRejectedValue({
            response: { status: 500, data: { mensagem: { erro: "Erro interno SAP" } } },
            message: "Request failed",
        });
        mockUpdate.mockResolvedValue({});

        const runner = new VendaRecDiferidaIntegrationRunner();
        await expect(runner.execute({ vendaRecDiferidaId: 1 })).rejects.toBeDefined();

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "ERRO_INTEG",
                    responseSap: JSON.stringify({ mensagem: { erro: "Erro interno SAP" } }),
                }),
            }),
        );
    });
});
