import { describe, expect, it, vi, beforeEach } from "vitest";

const { buildExecuteMock } = vi.hoisted(() => ({
    buildExecuteMock: vi.fn().mockResolvedValue([
        {
            codigoParceiro: "VEND001",
            tipoArApGl: "AP",
            tipoDocumento: "KR",
        },
    ]),
}));

vi.mock("../../../src/modules/documento-fiscal/utils/BuildSapIntegration", () => ({
    BuildSapIntegration: class {
        execute = buildExecuteMock;
    },
}));

const integracaoExecute = vi.fn();
vi.mock("../../../src/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry", () => ({
    IntegracaoSapCreateJournalEntryService: class {
        execute = integracaoExecute;
    },
}));

vi.mock("../../../src/modules/documento-fiscal/utils/integracao/post-integration/PostIntegrationUpdaterService", () => ({
    PostIntegrationUpdaterService: class {
        execute = vi.fn();
    },
}));

vi.mock("../../../src/modules/documento-fiscal/utils/integracao/EnviarRelatorioFornecedorEmailService", () => ({
    EnviarRelatorioFornecedorEmailService: class {
        execute = vi.fn();
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        documentoFiscalHeader: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({ tipoDocumentoERP: "TP_ROM" }),
            update: vi.fn().mockResolvedValue({}),
        },
    },
}));

import { IntegrationRunner } from "../../../src/modules/documento-fiscal/utils/integracao/IntegrationRunner";
import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("IntegrationRunner — retornoIntegracaoSap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUniqueOrThrow).mockResolvedValue({ tipoDocumentoERP: "TP_ROM" } as any);
        buildExecuteMock.mockResolvedValue([
            {
                codigoParceiro: "VEND001",
                tipoArApGl: "AP",
                tipoDocumento: "KR",
            },
        ]);
        integracaoExecute.mockRejectedValue({
            response: {
                status: 400,
                data: { mensagem: { erro: "Falha validação SAP" } },
            },
        });
    });

    it("deve persistir JSON do retorno SAP no header quando a integração HTTP falha", async () => {
        const runner = new IntegrationRunner();

        await expect(
            runner.execute({
                documentoFiscalHeaderId: 42,
                usuarioId: 1,
                failFast: true,
            })
        ).rejects.toBeDefined();

        expect(s4DotzClient.documentoFiscalHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42 },
                data: expect.objectContaining({
                    retornoIntegracaoSap: expect.any(String),
                }),
            })
        );

        const updateArg = vi.mocked(s4DotzClient.documentoFiscalHeader.update).mock.calls[0][0];
        const raw = (updateArg.data as { retornoIntegracaoSap: string }).retornoIntegracaoSap;
        const parsed = JSON.parse(raw);
        expect(parsed.origem).toBe("integration_runner");
        expect(parsed.resultados[0].mensagem).toBe("Falha validação SAP");
        expect(parsed.resultados[0].httpStatus).toBe(400);
    });

    it("deve persistir documentoJson e retornoIntegracaoSap quando a montagem do payload falha", async () => {
        buildExecuteMock.mockRejectedValue(
            new Error("Configuração contábil não encontrada para CIA 1 e tipoProcesso TP_ROM")
        );

        const runner = new IntegrationRunner();

        await expect(
            runner.execute({
                documentoFiscalHeaderId: 42,
                usuarioId: 1,
                failFast: true,
            })
        ).rejects.toThrow("Configuração contábil não encontrada para CIA 1 e tipoProcesso TP_ROM");

        expect(integracaoExecute).not.toHaveBeenCalled();
        expect(s4DotzClient.documentoFiscalHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42 },
                data: expect.objectContaining({
                    documentoJson: expect.stringContaining("Configuração contábil não encontrada"),
                    retornoIntegracaoSap: expect.stringContaining("Configuração contábil não encontrada"),
                }),
            })
        );

        const updateArg = vi.mocked(s4DotzClient.documentoFiscalHeader.update).mock.calls[0][0];
        const retorno = JSON.parse((updateArg.data as { retornoIntegracaoSap: string }).retornoIntegracaoSap);
        expect(retorno.origem).toBe("build_failure");

        const documento = JSON.parse((updateArg.data as { documentoJson: string }).documentoJson);
        expect(documento.payloads[0].erro).toBe("Falha ao montar payload de integração SAP");
    });
});
