import { describe, expect, it, vi, beforeEach } from "vitest";

const { publishVendasRelatorioEmailMock } = vi.hoisted(() => ({
    publishVendasRelatorioEmailMock: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findUnique: vi.fn(),
        },
        cia: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: vi.fn(),
}));

vi.mock("../../../src/queue/producers/emailProducer", () => ({
    publishVendasRelatorioEmail: publishVendasRelatorioEmailMock,
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import dotzStageClient from "../../../src/database/clients/dotzStageClient";
import { EnviarVendasEmailService } from "../../../src/modules/vendas/utils/EnviarVendasEmailService";
import AppError from "../../../src/util/AppError";

function makeVenda(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 10,
        ciaIdSAP: "1410",
        codigoClienteSAP: "BP123",
        dataEmissao: new Date("2026-06-25T00:00:00.000Z"),
        dataVencimento: new Date("2026-06-30T00:00:00.000Z"),
        relatorioPdf: "https://storage.googleapis.com/bucket/relatorios/relatorio-vendas-10.pdf",
        relatorioXlsx: "https://storage.googleapis.com/bucket/relatorios/relatorio-vendas-10.xlsx",
        pathBoleto: "https://storage.googleapis.com/bucket/boletos/boleto-10-2026.pdf",
        codigoBoleto: "S4P#1410#2026#1900002341#VBRK#BP123",
        pathArquivoFaturaDetalhadaAnalyzer: null,
        pathArquivoRelatorioAnalitico: null,
        ...overrides,
    };
}

describe("EnviarVendasEmailService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(dotzStageClient).mockReturnValue({
            oCRD: { findUnique: vi.fn().mockResolvedValue({ email: "fornecedor@example.com" }) },
        } as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue({ telefone: "11987654321" } as any);
    });

    it("lanca AppError e nao publica email quando a venda nao existe", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(null);

        await expect(
            new EnviarVendasEmailService().execute({ vendasHeaderId: 999 }),
        ).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<AppError>);

        expect(publishVendasRelatorioEmailMock).not.toHaveBeenCalled();
    });

    it("lanca AppError e nao publica email quando a venda nao tem codigoClienteSAP", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ codigoClienteSAP: null }) as any,
        );

        await expect(
            new EnviarVendasEmailService().execute({ vendasHeaderId: 10 }),
        ).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<AppError>);

        expect(publishVendasRelatorioEmailMock).not.toHaveBeenCalled();
    });

    it("lanca AppError e nao publica email quando o fornecedor nao tem email cadastrado", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(dotzStageClient).mockReturnValue({
            oCRD: { findUnique: vi.fn().mockResolvedValue(null) },
        } as any);

        await expect(
            new EnviarVendasEmailService().execute({ vendasHeaderId: 10 }),
        ).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<AppError>);

        expect(publishVendasRelatorioEmailMock).not.toHaveBeenCalled();
    });

    it("lanca AppError e nao publica email quando falta o relatorio PDF", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ relatorioPdf: null }) as any,
        );

        await expect(
            new EnviarVendasEmailService().execute({ vendasHeaderId: 10 }),
        ).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<AppError>);

        expect(publishVendasRelatorioEmailMock).not.toHaveBeenCalled();
    });

    it("lanca AppError e nao publica email quando falta o relatorio XLSX", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ relatorioXlsx: null }) as any,
        );

        await expect(
            new EnviarVendasEmailService().execute({ vendasHeaderId: 10 }),
        ).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<AppError>);

        expect(publishVendasRelatorioEmailMock).not.toHaveBeenCalled();
    });

    it("publica o email com todos os anexos (relatorio, boleto e arquivos Analyzer) quando presentes", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({
                pathArquivoFaturaDetalhadaAnalyzer:
                    "https://analyzer.example.com/files/fatura-detalhada.pdf?token=abc123",
                pathArquivoRelatorioAnalitico:
                    "https://analyzer.example.com/files/relatorio-analitico.pdf",
            }) as any,
        );

        await new EnviarVendasEmailService().execute({ vendasHeaderId: 10 });

        expect(publishVendasRelatorioEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                vendasHeaderId: 10,
                email: "fornecedor@example.com",
                dataEmissao: "25/06/2026",
                dataVencimento: "30/06/2026",
                codigoBoleto: "S4P#1410#2026#1900002341#VBRK#BP123",
                relatorioPdfFilename: "relatorio-vendas-10.pdf",
                relatorioPdfPath: "https://storage.googleapis.com/bucket/relatorios/relatorio-vendas-10.pdf",
                relatorioXlsxFilename: "relatorio-vendas-10.xlsx",
                relatorioXlsxPath: "https://storage.googleapis.com/bucket/relatorios/relatorio-vendas-10.xlsx",
                boletoFilename: "boleto-10-2026.pdf",
                boletoPath: "https://storage.googleapis.com/bucket/boletos/boleto-10-2026.pdf",
                analyzerFaturaDetalhadaFilename: "fatura-detalhada.pdf",
                analyzerFaturaDetalhadaPath:
                    "https://analyzer.example.com/files/fatura-detalhada.pdf?token=abc123",
                analyzerRelatorioAnaliticoFilename: "relatorio-analitico.pdf",
                analyzerRelatorioAnaliticoPath: "https://analyzer.example.com/files/relatorio-analitico.pdf",
            }),
        );
    });

    it("nao inclui anexos opcionais (boleto, Analyzer) quando ausentes", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ pathBoleto: null }) as any,
        );

        await new EnviarVendasEmailService().execute({ vendasHeaderId: 10 });

        expect(publishVendasRelatorioEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                boletoFilename: undefined,
                boletoPath: undefined,
                analyzerFaturaDetalhadaFilename: undefined,
                analyzerFaturaDetalhadaPath: undefined,
                analyzerRelatorioAnaliticoFilename: undefined,
                analyzerRelatorioAnaliticoPath: undefined,
            }),
        );
    });

    it("trata o valor do Analyzer como URL, mesmo que nao seja um path local existente", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({
                pathArquivoFaturaDetalhadaAnalyzer: "https://analyzer.example.com/nao-existe-em-disco.pdf",
            }) as any,
        );

        await new EnviarVendasEmailService().execute({ vendasHeaderId: 10 });

        expect(publishVendasRelatorioEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                analyzerFaturaDetalhadaFilename: "nao-existe-em-disco.pdf",
                analyzerFaturaDetalhadaPath: "https://analyzer.example.com/nao-existe-em-disco.pdf",
            }),
        );
    });
});
