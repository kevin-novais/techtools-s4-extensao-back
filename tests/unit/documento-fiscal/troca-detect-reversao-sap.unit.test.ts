import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindManyAccountingDoc,
    mockFindFirstDetalheHeader,
    mockUpdateManyHeader,
    mockFindManyDetalhe,
    mockOporFindMany,
    mockOporUpdateMany,
    mockPor1UpdateMany,
} = vi.hoisted(() => ({
    mockFindManyAccountingDoc: vi.fn(),
    mockFindFirstDetalheHeader: vi.fn(),
    mockUpdateManyHeader: vi.fn(),
    mockFindManyDetalhe: vi.fn(),
    mockOporFindMany: vi.fn(),
    mockOporUpdateMany: vi.fn(),
    mockPor1UpdateMany: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        accountingDocumentItem: { findMany: mockFindManyAccountingDoc },
        documentoFiscalHeader: { updateMany: mockUpdateManyHeader },
        documentoFiscalDetalhe: { findFirst: mockFindFirstDetalheHeader, findMany: mockFindManyDetalhe },
    },
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: () => ({
        OPOR: { findMany: mockOporFindMany, updateMany: mockOporUpdateMany },
        POR1: { updateMany: mockPor1UpdateMany },
    }),
}));

import { TrocaDetectReversaoSapService } from "../../../src/modules/documento-fiscal/cancelamento/services/TrocaDetectReversaoSapService";
import { ReabrirPedidosTrocaService } from "../../../src/modules/documento-fiscal/cancelamento/services/ReabrirPedidosTrocaService";

describe("ReabrirPedidosTrocaService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reabre OPOR e POR1 dos pedidos do header", async () => {
        mockFindManyDetalhe.mockResolvedValue([
            { codigoPedidoParceiro: "1001" },
            { codigoPedidoParceiro: "1002" },
            { codigoPedidoParceiro: "1001" }, // duplicado
        ]);
        mockOporFindMany.mockResolvedValue([{ DocEntry: 50 }, { DocEntry: 51 }]);
        mockOporUpdateMany.mockResolvedValue({ count: 2 });
        mockPor1UpdateMany.mockResolvedValue({ count: 3 });

        const service = new ReabrirPedidosTrocaService();
        const result = await service.execute(99);

        expect(result.pedidos).toEqual([1001, 1002]);
        expect(mockOporUpdateMany).toHaveBeenCalledWith({
            where: { U_DOTZNRPED: { in: [1001, 1002] } },
            data: { DocStatus: "O" },
        });
        expect(mockPor1UpdateMany).toHaveBeenCalledWith({
            where: { DocEntry: { in: [50, 51] } },
            data: { LineStatus: "O", U_DocEntryNF: null },
        });
        expect(result.oporReabertos).toBe(2);
        expect(result.por1Reabertos).toBe(3);
    });

    it("não faz nada quando o header não tem pedidos de parceiro", async () => {
        mockFindManyDetalhe.mockResolvedValue([{ codigoPedidoParceiro: null }]);

        const service = new ReabrirPedidosTrocaService();
        const result = await service.execute(99);

        expect(result).toEqual({ pedidos: [], oporReabertos: 0, por1Reabertos: 0 });
        expect(mockOporUpdateMany).not.toHaveBeenCalled();
        expect(mockPor1UpdateMany).not.toHaveBeenCalled();
    });

    it("não atualiza POR1 quando nenhum OPOR é encontrado", async () => {
        mockFindManyDetalhe.mockResolvedValue([{ codigoPedidoParceiro: "1001" }]);
        mockOporFindMany.mockResolvedValue([]);
        mockOporUpdateMany.mockResolvedValue({ count: 0 });

        const service = new ReabrirPedidosTrocaService();
        await service.execute(99);

        expect(mockPor1UpdateMany).not.toHaveBeenCalled();
    });
});

describe("TrocaDetectReversaoSapService", () => {
    const reabrirMock = { execute: vi.fn() };
    const buildService = () =>
        new TrocaDetectReversaoSapService(reabrirMock as unknown as ReabrirPedidosTrocaService);

    beforeEach(() => {
        vi.clearAllMocks();
        reabrirMock.execute.mockResolvedValue({ pedidos: [1], oporReabertos: 1, por1Reabertos: 1 });
        mockUpdateManyHeader.mockResolvedValue({ count: 1 });
    });

    it("retorna zero quando não há JEs de reversão", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([]);

        const result = await buildService().execute();

        expect(result.totalReversoesSap).toBe(0);
        expect(result.totalHeadersCancelados).toBe(0);
        expect(mockFindFirstDetalheHeader).not.toHaveBeenCalled();
    });

    it("não cancela quando a reversão não corresponde a nenhum romaneio integrado", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue(null);

        const result = await buildService().execute();

        expect(result.totalReversoesSap).toBe(1);
        expect(result.totalHeadersCancelados).toBe(0);
        expect(reabrirMock.execute).not.toHaveBeenCalled();
        expect(mockUpdateManyHeader).not.toHaveBeenCalled();
    });

    it("reabre pedidos e cancela o romaneio quando encontra o detalhe integrado", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue({ documentoFiscalHeaderId: 77 });

        const result = await buildService().execute();

        expect(result.totalReversoesSap).toBe(1);
        expect(result.totalHeadersCancelados).toBe(1);
        expect(reabrirMock.execute).toHaveBeenCalledWith(77);
        expect(mockUpdateManyHeader).toHaveBeenCalledWith({
            where: { id: 77, status: { not: "CANCELADO" } },
            data: { status: "CANCELADO" },
        });
    });

    it("deduplica múltiplos itens do mesmo documento de reversão", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue({ documentoFiscalHeaderId: 77 });

        const result = await buildService().execute();

        expect(result.totalReversoesSap).toBe(1);
        expect(mockFindFirstDetalheHeader).toHaveBeenCalledTimes(1);
    });

    it("não conta header já CANCELADO (idempotência)", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue({ documentoFiscalHeaderId: 77 });
        mockUpdateManyHeader.mockResolvedValue({ count: 0 });

        const result = await buildService().execute();

        expect(result.totalHeadersCancelados).toBe(0);
    });

    it("continua processando os demais quando um documento falha", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021" },
            { CompanyCode: "1000", ReverseDocument: "1900000022" },
        ]);
        mockFindFirstDetalheHeader
            .mockRejectedValueOnce(new Error("DB timeout"))
            .mockResolvedValueOnce({ documentoFiscalHeaderId: 88 });

        const result = await buildService().execute();

        expect(result.totalHeadersCancelados).toBe(1);
        expect(reabrirMock.execute).toHaveBeenCalledWith(88);
    });

    it("filtra o detalhe pelo ano (header.ano) — SAP reinicia a sequência do código por ano", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021", ReverseDocumentFiscalYear: "2026" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue({ documentoFiscalHeaderId: 77 });

        await buildService().execute();

        expect(mockFindFirstDetalheHeader).toHaveBeenCalledWith({
            where: {
                codigoDocumentoERP: "1900000021",
                documentoFiscalHeader: { status: { not: "CANCELADO" }, ano: 2026 },
            },
            select: { documentoFiscalHeaderId: true },
        });
    });

    it("não deduplica o mesmo código em anos fiscais diferentes", async () => {
        mockFindManyAccountingDoc.mockResolvedValue([
            { CompanyCode: "1000", ReverseDocument: "1900000021", ReverseDocumentFiscalYear: "2025" },
            { CompanyCode: "1000", ReverseDocument: "1900000021", ReverseDocumentFiscalYear: "2026" },
        ]);
        mockFindFirstDetalheHeader.mockResolvedValue(null);

        const result = await buildService().execute();

        expect(result.totalReversoesSap).toBe(2);
        expect(mockFindFirstDetalheHeader).toHaveBeenCalledTimes(2);
    });
});
