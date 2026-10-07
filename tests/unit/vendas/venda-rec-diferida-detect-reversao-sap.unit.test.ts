import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindManyAccountingDoc,
    mockFindFirstParcela,
    mockUpdateParcela,
    mockUpdateManyHeader,
    mockPublishReverter,
} = vi.hoisted(() => ({
    mockFindManyAccountingDoc: vi.fn(),
    mockFindFirstParcela: vi.fn(),
    mockUpdateParcela: vi.fn(),
    mockUpdateManyHeader: vi.fn(),
    mockPublishReverter: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        accountingDocumentItem: {
            findMany: mockFindManyAccountingDoc,
        },
        vendaRecDiferida: {
            findFirst: mockFindFirstParcela,
            update: mockUpdateParcela,
        },
        vendasHeader: {
            updateMany: mockUpdateManyHeader,
        },
    },
}));

vi.mock("../../../src/queue/producers/vendaRecDiferidaProducer", () => ({
    publishReverterDiferida: mockPublishReverter,
}));

import { VendaRecDiferidaDetectReversaoSapService } from "../../../src/modules/vendas/services/VendaRecDiferidaDetectReversaoSapService";

describe("VendaRecDiferidaDetectReversaoSapService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPublishReverter.mockResolvedValue(undefined);
        mockUpdateParcela.mockResolvedValue({});
        mockUpdateManyHeader.mockResolvedValue({ count: 1 });
    });

    it("deve retornar zero quando não há JEs de reversão no registros_contabeis", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([]);

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalReversoesSap).toBe(0);
        expect(result.totalParcelasEnfileiradas).toBe(0);
        expect(mockFindFirstParcela).not.toHaveBeenCalled();
    });

    it("deve retornar zero enfileiradas quando reversão SAP não corresponde a nenhuma VendaRecDiferida", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        mockFindFirstParcela.mockResolvedValue(null);

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalReversoesSap).toBe(1);
        expect(result.totalParcelasEnfileiradas).toBe(0);
        expect(mockUpdateParcela).not.toHaveBeenCalled();
        expect(mockPublishReverter).not.toHaveBeenCalled();
    });

    it("deve marcar REVERSAO_PENDENTE e enfileirar quando VendaRecDiferida está INTEGRADA", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        mockFindFirstParcela.mockResolvedValue({ id: 42, vendasHeaderId: 7 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalReversoesSap).toBe(1);
        expect(result.totalParcelasEnfileiradas).toBe(1);

        expect(mockUpdateParcela).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { status: "REVERSAO_PENDENTE" },
        });
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 42 });
    });

    it("deve cancelar o header da venda (DTZ-278) ao reconhecer a reversão", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        mockFindFirstParcela.mockResolvedValue({ id: 42, vendasHeaderId: 7 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalHeadersCancelados).toBe(1);
        expect(mockUpdateManyHeader).toHaveBeenCalledWith({
            where: { id: 7, status: { not: "CANCELADO" } },
            data: { status: "CANCELADO" },
        });
    });

    it("não deve contar header já CANCELADO (idempotência DTZ-278)", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        mockFindFirstParcela.mockResolvedValue({ id: 42, vendasHeaderId: 7 });
        mockUpdateManyHeader.mockResolvedValue({ count: 0 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalHeadersCancelados).toBe(0);
        expect(mockUpdateManyHeader).toHaveBeenCalledTimes(1);
    });

    it("deve deduplcar múltiplos itens do mesmo documento (mesmo ReverseDocument)", async () => {
        // Um documento contábil tem vários itens — todos apontam para o mesmo ReverseDocument
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        mockFindFirstParcela.mockResolvedValue({ id: 42, vendasHeaderId: 7 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        // Após dedupe, apenas 1 JE único
        expect(result.totalReversoesSap).toBe(1);
        expect(result.totalParcelasEnfileiradas).toBe(1);
        expect(mockFindFirstParcela).toHaveBeenCalledTimes(1);
    });

    it("deve processar múltiplos documentos diferentes de reversão independentemente", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
            { CompanyCode: "1000", ReverseDocument: "4900000002" },
        ]);
        mockFindFirstParcela
            .mockResolvedValueOnce({ id: 10, vendasHeaderId: 1 })
            .mockResolvedValueOnce({ id: 20, vendasHeaderId: 2 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalReversoesSap).toBe(2);
        expect(result.totalParcelasEnfileiradas).toBe(2);
        expect(mockPublishReverter).toHaveBeenCalledTimes(2);
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 10 });
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 20 });
    });

    it("deve continuar processando os demais quando um documento falha", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
            { CompanyCode: "1000", ReverseDocument: "4900000002" },
        ]);
        mockFindFirstParcela
            .mockRejectedValueOnce(new Error("DB timeout"))
            .mockResolvedValueOnce({ id: 20, vendasHeaderId: 2 });

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        // O primeiro falhou mas o segundo foi processado
        expect(result.totalParcelasEnfileiradas).toBe(1);
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 20 });
    });

    it("não deve processar quando findFirst retorna parcela não-INTEGRADA (idempotência)", async () => {
        // findFirst com filtro status=INTEGRADO — se já está REVERSAO_PENDENTE retorna null
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001" },
        ]);
        // Simula que a parcela não foi encontrada com status INTEGRADO (já foi processada antes)
        mockFindFirstParcela.mockResolvedValue(null);

        const service = new VendaRecDiferidaDetectReversaoSapService();
        const result = await service.execute();

        expect(result.totalParcelasEnfileiradas).toBe(0);
        expect(mockUpdateParcela).not.toHaveBeenCalled();
        expect(mockPublishReverter).not.toHaveBeenCalled();
    });

    it("filtra a parcela pelo ano fiscal (SAP reinicia a sequência do código por ano)", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001", ReverseDocumentFiscalYear: "2026" },
        ]);
        mockFindFirstParcela.mockResolvedValue({ id: 42, vendasHeaderId: 7 });

        await new VendaRecDiferidaDetectReversaoSapService().execute();

        expect(mockFindFirstParcela).toHaveBeenCalledWith({
            where: { codigoDocumentoErp: "4900000001", ano: 2026, status: "INTEGRADO" },
            select: { id: true, vendasHeaderId: true },
        });
    });

    it("não deduplica o mesmo código em anos fiscais diferentes", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "4900000001", ReverseDocumentFiscalYear: "2025" },
            { CompanyCode: "1000", ReverseDocument: "4900000001", ReverseDocumentFiscalYear: "2026" },
        ]);
        mockFindFirstParcela.mockResolvedValue(null);

        const result = await new VendaRecDiferidaDetectReversaoSapService().execute();

        expect(result.totalReversoesSap).toBe(2);
        expect(mockFindFirstParcela).toHaveBeenCalledTimes(2);
    });
});
