import { describe, expect, it, vi, beforeEach } from "vitest";

const { integrateMock } = vi.hoisted(() => ({
    integrateMock: vi.fn(),
}));

vi.mock("../../../src/modules/documento-fiscal/utils/integracao/IntegrationOrchestratorService", () => ({
    IntegrationOrchestratorService: class {
        integrate = integrateMock;
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        documentoFiscalHeader: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        documentoFiscalErrors: {
            findFirst: vi.fn(),
        },
        usuarioGrupoUsuario: {
            findMany: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { DocumentoFiscalApproveService } from "../../../src/modules/documento-fiscal/documento-header/documento/services/DocumentoFiscalApproveService";
import { StatusDocumento } from "../../../src/@types/DocumentoFiscalHeader/StatusDocumentoTypes";

function mockDocumentoBase() {
    vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
        id: 1,
        ciaId: 10,
        status: StatusDocumento.DIVERGENCIA,
        cia: { id: 10, nome: "CIA Teste" },
    } as any);

    vi.mocked(s4DotzClient.documentoFiscalErrors.findFirst).mockResolvedValue(null);

    vi.mocked(s4DotzClient.usuarioGrupoUsuario.findMany).mockResolvedValue([
        {
            grupoUsuario: {
                id: 1,
                dataInicio: new Date("2000-01-01"),
                dataFim: new Date("2099-12-31"),
                aprovaDivergencia: true,
            },
        },
    ] as any);

    vi.mocked(s4DotzClient.documentoFiscalHeader.update).mockResolvedValue({} as any);
}

describe("DocumentoFiscalApproveService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDocumentoBase();
    });

    it("deve persistir sucesso e falha juntos quando apenas parte dos fornecedores falha", async () => {
        integrateMock.mockResolvedValue({
            resultados: [
                {
                    codigoParceiro: "F001",
                    status: "sucesso",
                    statusCode: 201,
                    numeroDocumentoERP: "SAP-001",
                    mensagem: "Documento criado com sucesso",
                },
                {
                    codigoParceiro: "F002",
                    status: "erro",
                    statusCode: 500,
                    mensagem: "Erro interno SAP",
                },
            ],
        });

        const service = new DocumentoFiscalApproveService();

        await expect(
            service.execute({
                documentoId: 1,
                usuarioId: 99,
                ciaIds: [10],
                observacao: "teste",
            }),
        ).rejects.toMatchObject({
            message: "Não foi possível aprovar o documento devido a falhas na integração SAP",
            statusCode: 400,
        });

        expect(s4DotzClient.documentoFiscalHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: StatusDocumento.ERRO_INTEG,
                    retornoIntegracaoSap: expect.any(String),
                }),
            }),
        );

        const updateArg = vi.mocked(s4DotzClient.documentoFiscalHeader.update).mock.calls[0][0];
        const retorno = JSON.parse((updateArg.data as { retornoIntegracaoSap: string }).retornoIntegracaoSap);

        expect(retorno.origem).toBe("approve_failure");
        expect(retorno.resultados).toHaveLength(2);
        expect(retorno.resultados.find((r: any) => r.codigoParceiro === "F001").statusIntegracao).toBe("sucesso");
        expect(retorno.resultados.find((r: any) => r.codigoParceiro === "F002").statusIntegracao).toBe("erro");
    });
});
