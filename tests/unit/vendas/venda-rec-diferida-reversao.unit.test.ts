import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockSapCreate, mockFindUnique, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
    mockSapCreate: vi.fn(),
    mockFindUnique: vi.fn(),
    mockFindFirst: vi.fn(),
    mockUpdate: vi.fn(),
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
        cia: { findFirst: mockFindFirst },
    },
}));

import { VendaRecDiferidaReversaoService } from "../../../src/modules/vendas/utils/integracao/VendaRecDiferidaReversaoService";
import AppError from "../../../src/util/AppError";

const baseParcela = {
    id: 1,
    status: "REVERSAO_PENDENTE",
    vendasHeaderId: 10,
    periodoDiferimento: 2,
    dataDiferimento: new Date("2026-03-01T00:00:00.000Z"),
    valorDiferimento: { toFixed: () => "100.00", toString: () => "100" } as any,
    tipoContabilErpReversao: null,
    tipoDocumentoErpReversao: null,
    contaCreditoReversao: null,
    contaDebitoReversao: null,
    centroLucroReversao: null,
    centroCustoReversao: null,
    tipoContabilErp: "GL",
    tipoDocumentoErp: "RD",
    contaCredito: "4000001",
    contaDebito: "1000001",
    centroLucro: "LP01",
    centroCusto: null,
    vendasHeader: {
        ciaId: 1000,
        codigoClienteSAP: "C000001",
        numeroDocumentoAnalyzer: "DOC-2026",
    },
};

describe("VendaRecDiferidaReversaoService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando parcela não encontrada", async () => {
        mockFindUnique.mockResolvedValue(null);

        const service = new VendaRecDiferidaReversaoService();
        await expect(service.execute({ vendaRecDiferidaId: 999 })).rejects.toMatchObject({
            message: "Parcela diferida não encontrada",
            statusCode: 404,
        });
    });

    it("deve lançar AppError 400 quando parcela não está em REVERSAO_PENDENTE", async () => {
        mockFindUnique.mockResolvedValue({ ...baseParcela, status: "INTEGRADO" });

        const service = new VendaRecDiferidaReversaoService();
        await expect(service.execute({ vendaRecDiferidaId: 1 })).rejects.toBeInstanceOf(AppError);
    });

    it("deve reverter e atualizar status para REVERTIDO quando SAP responde 201", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockFindFirst.mockResolvedValue({ ciaIdSAP: "1000" });
        mockSapCreate.mockResolvedValue({
            status: 201,
            data: { numeroDocumentoERP: "5900000001", mensagem: "Revertido" },
        });
        mockUpdate.mockResolvedValue({});

        const service = new VendaRecDiferidaReversaoService();
        const result = await service.execute({ vendaRecDiferidaId: 1 });

        expect(result.status).toBe("sucesso");
        expect(result.statusCode).toBe(201);
        expect(result.codigoDocumentoErpReversao).toBe("5900000001");

        // Primeira chamada: grava o request enviado ao SAP, ainda sem resposta
        expect(mockUpdate).toHaveBeenNthCalledWith(1, {
            where: { id: 1 },
            data: { requestSap: expect.any(String), responseSap: null },
        });

        // Segunda chamada: grava o resultado da reversão, incluindo a resposta do SAP
        expect(mockUpdate).toHaveBeenNthCalledWith(2, {
            where: { id: 1 },
            data: expect.objectContaining({
                status: "REVERTIDO",
                codigoDocumentoErpReversao: "5900000001",
                responseSap: JSON.stringify({
                    numeroDocumentoERP: "5900000001",
                    mensagem: "Revertido",
                }),
            }),
        });
    });

    it("deve inverter débito/crédito originais quando campos de reversão não preenchidos", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockFindFirst.mockResolvedValue({ ciaIdSAP: "1000" });
        mockSapCreate.mockResolvedValue({
            status: 201,
            data: { numeroDocumentoERP: "5900000002" },
        });
        mockUpdate.mockResolvedValue({});

        const service = new VendaRecDiferidaReversaoService();
        await service.execute({ vendaRecDiferidaId: 1 });

        const sapPayload = mockSapCreate.mock.calls[0][0];
        const contas = sapPayload.lancamentosContabeis.map((l: any) => l.conta);

        // contaDebito original → contaCredito de reversão, e vice-versa
        expect(contas).toContain("4000001");
        expect(contas).toContain("1000001");
    });

    it("deve marcar ERRO_REVERT e relançar quando SAP lança exceção", async () => {
        mockFindUnique.mockResolvedValue(baseParcela);
        mockFindFirst.mockResolvedValue({ ciaIdSAP: "1000" });
        mockSapCreate.mockRejectedValue({
            response: { status: 500, data: { mensagem: "Erro SAP" } },
            message: "Request failed",
        });
        mockUpdate.mockResolvedValue({});

        const service = new VendaRecDiferidaReversaoService();
        await expect(service.execute({ vendaRecDiferidaId: 1 })).rejects.toBeDefined();

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "ERRO_REVERT",
                    responseSap: expect.any(String),
                }),
            }),
        );
    });
});
