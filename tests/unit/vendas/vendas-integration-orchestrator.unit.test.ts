import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    runnerExecuteMock,
    relatorioExecuteMock,
    gerarParcelasExecuteMock,
    ocrdFindFirstMock,
} = vi.hoisted(() => ({
    runnerExecuteMock: vi.fn(),
    relatorioExecuteMock: vi.fn(),
    gerarParcelasExecuteMock: vi.fn(),
    ocrdFindFirstMock: vi.fn(),
}));

vi.mock("../../../src/modules/vendas/utils/integracao/VendasIntegrationRunner", () => ({
    VendasIntegrationRunner: class {
        execute = runnerExecuteMock;
    },
}));

vi.mock("../../../src/modules/vendas/utils/relatorio/GerarRelatorioVendasService", () => ({
    GerarRelatorioVendasService: class {
        execute = relatorioExecuteMock;
    },
}));

vi.mock("../../../src/modules/vendas/services/VendaRecDiferidaGerarParcelasService", () => ({
    VendaRecDiferidaGerarParcelasService: class {
        execute = gerarParcelasExecuteMock;
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: () => ({
        oCRD: {
            findFirst: ocrdFindFirstMock,
        },
    }),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { VendasIntegrationOrchestratorService } from "../../../src/modules/vendas/utils/integracao/VendasIntegrationOrchestratorService";

describe("VendasIntegrationOrchestratorService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        relatorioExecuteMock.mockResolvedValue({
            pdfUrl: "http://localhost/relatorios/test.pdf",
            pdfFilename: "test.pdf",
            xlsxUrl: "http://localhost/relatorios/test.xlsx",
            xlsxFilename: "test.xlsx",
        });
        gerarParcelasExecuteMock.mockResolvedValue({ totalParcelas: 0 });
        ocrdFindFirstMock.mockResolvedValue({ FORMA_PAGAMENTO: "" });
    });

    it("deve lançar erro quando venda não encontrada", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(null);

        const service = new VendasIntegrationOrchestratorService();

        await expect(
            service.integrate({ vendasHeaderId: 999 }),
        ).rejects.toThrow("Venda 999 não encontrada");
    });

    it("deve retornar status ignorado quando venda já está integrada", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "INTEG_SAP",
        } as any);

        const service = new VendasIntegrationOrchestratorService();
        const result = await service.integrate({ vendasHeaderId: 1 });

        expect(result.status).toBe("ignorado");
        expect(result.resultados).toEqual([]);
        expect(runnerExecuteMock).not.toHaveBeenCalled();
    });

    it("deve executar runner, persistir codigoDocumentoERP e atualizar status para INTEG_SAP", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "PROCESSANDO",
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);

        const mockResultados = [
            { codigoParceiro: "C000001", status: "sucesso", statusCode: 201, numeroDocumentoERP: "SAP-001" },
        ];
        runnerExecuteMock.mockResolvedValue(mockResultados);

        const service = new VendasIntegrationOrchestratorService();
        const result = await service.integrate({ vendasHeaderId: 1 });

        expect(result.status).toBe("integrado");
        expect(result.resultados).toEqual(mockResultados);

        expect(runnerExecuteMock).toHaveBeenCalledWith({
            vendasHeaderId: 1,
            failFast: true,
        });
        expect(gerarParcelasExecuteMock).toHaveBeenCalledWith({
            vendasHeaderId: 1,
        });

        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: "INTEG_SAP",
                    codigoDocumentoERP: "SAP-001",
                    dataIntegracao: expect.any(Date),
                }),
            }),
        );
    });

    it("deve gerar relatórios após integração SAP com sucesso", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "PROCESSANDO",
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
        runnerExecuteMock.mockResolvedValue([
            { codigoParceiro: "C000001", status: "sucesso", statusCode: 201, numeroDocumentoERP: "SAP-001" },
        ]);

        const service = new VendasIntegrationOrchestratorService();
        await service.integrate({ vendasHeaderId: 1 });

        expect(relatorioExecuteMock).toHaveBeenCalledWith({ vendasHeaderId: 1 });
    });

    it("deve não falhar a integração se geração de relatório der erro", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "PROCESSANDO",
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
        runnerExecuteMock.mockResolvedValue([
            { codigoParceiro: "C000001", status: "sucesso", statusCode: 201 },
        ]);
        relatorioExecuteMock.mockRejectedValue(new Error("Erro ao gerar PDF"));

        const service = new VendasIntegrationOrchestratorService();
        const result = await service.integrate({ vendasHeaderId: 1 });

        expect(result.status).toBe("integrado");
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalled();
    });

    it("deve não atualizar status quando updateStatus é false", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "PROCESSANDO",
        } as any);

        runnerExecuteMock.mockResolvedValue([]);

        const service = new VendasIntegrationOrchestratorService();
        await service.integrate({
            vendasHeaderId: 1,
            updateStatus: false,
        });

        expect(s4DotzClient.vendasHeader.update).not.toHaveBeenCalled();
        expect(relatorioExecuteMock).not.toHaveBeenCalled();
    });

    it("deve propagar failFast para o runner", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            status: "PROCESSANDO",
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
        runnerExecuteMock.mockResolvedValue([]);

        const service = new VendasIntegrationOrchestratorService();
        await service.integrate({ vendasHeaderId: 1, failFast: false });

        expect(runnerExecuteMock).toHaveBeenCalledWith({
            vendasHeaderId: 1,
            failFast: false,
        });
    });
});
