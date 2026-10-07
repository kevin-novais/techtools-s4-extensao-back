import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    stageFindManyMock,
    stageDetalhesFindManyMock,
    stageUpdateMock,
    vendaFindFirstMock,
    vendaCreateMock,
    getPublicUrlMock,
} = vi.hoisted(() => ({
    stageFindManyMock: vi.fn(),
    stageDetalhesFindManyMock: vi.fn(),
    stageUpdateMock: vi.fn(),
    vendaFindFirstMock: vi.fn(),
    vendaCreateMock: vi.fn(),
    getPublicUrlMock: vi.fn(
        (blobName: string) => `https://storage.example.com/${blobName}`,
    ),
}));

vi.mock("@/providers/gcs-storage", () => ({
    GCSStorage: class {
        getPublicUrl = getPublicUrlMock;
    },
}));

vi.mock("@/database/clients/dotzStageClient", () => ({
    default: () => ({
        faturamento: {
            findMany: stageFindManyMock,
            update: stageUpdateMock,
        },
        faturamentoDetalhe: {
            findMany: stageDetalhesFindManyMock,
        },
    }),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findFirst: vendaFindFirstMock,
            create: vendaCreateMock,
        },
    },
}));

import { Prisma } from "@prisma/client-dotz-stage";
import { processVendasIntegracaoAnalyzerJob } from "../../../src/cron/jobs/processVendasIntegracaoAnalyzerJob";

const faturamento = {
    Id: new Prisma.Decimal(10),
    OrigemRegistro: "A",
    Companhia: "1000      ",
    CodigoParceiro: new Prisma.Decimal(12345),
    NumeroDocumento: "DOC-001",
    CnpjParceiro: "12345678000199",
    NomeParceiro: "Cliente",
    NumeroFatura: "FAT-001",
    NumeroFaturaParceiro: "FP-001",
    DataCriacao: new Date("2026-07-21T10:00:00.000Z"),
    DataEmissao: new Date("2026-07-20T00:00:00.000Z"),
    DataFechamento: new Date("2026-07-21T00:00:00.000Z"),
    PeriodoFechamentoDe: new Date("2026-07-01T00:00:00.000Z"),
    PeriodoFechamentoAte: new Date("2026-07-20T00:00:00.000Z"),
    TipoDadoDescricao: "Venda",
    TextoDocumento: " Referência Analyzer ",
    ValorConsumoPeriodo: new Prisma.Decimal("90.00"),
    ValorFaturamentoMinimo: new Prisma.Decimal("0.00"),
    ValorSaldoRetroativo: new Prisma.Decimal("0.00"),
    ValorExcedente: new Prisma.Decimal("0.00"),
    ValorEstornosCredito: new Prisma.Decimal("0.00"),
    ValorFatura: new Prisma.Decimal("100.50"),
    CaminhoFaturaDetalhada: " FATURAMENTO/10/fatura-detalhada.xlsx ",
    CaminhoAnexo2: null,
    CaminhoAnexo3: null,
    CaminhoAnexo4: null,
    CaminhoBoleto: null,
    CaminhoFatura: "/FATURAMENTO/10/relatorio-analitico.pdf",
    StatusRegistro: "1",
    DataInclusao: new Date("2026-07-21T10:00:00.000Z"),
    UsuarioInclusao: "ANALYZER",
    DataAlteracao: null,
    UsuarioAlteracao: null,
    DataReversaoAnalyzer: null,
};

const faturamentoDetalhe = {
    Id: new Prisma.Decimal(1),
    FaturamentoId: faturamento.Id,
    OrigemRegistro: "A",
    TipoOperacao: "1",
    CodigoProduto: "PONTO-01",
    DescricaoProduto: "Produto de pontos",
    UnidadeMedida: "UN",
    CodigoPromocao: null,
    DescricaoPromocao: null,
    TipoPonto: null,
    CentroLucro: "CL-01",
    CentroCusto: "CC-01",
    NumeroTransacoes: new Prisma.Decimal(2),
    QuantidadePontos: new Prisma.Decimal(5000),
    CustoUnitarioPonto: new Prisma.Decimal("0.012345"),
    ValorTotalItem: new Prisma.Decimal("61.73"),
    DataInclusao: new Date("2026-07-21T10:00:00.000Z"),
    UsuarioInclusao: "ANALYZER",
    DataAlteracao: null,
    UsuarioAlteracao: null,
};

describe("processVendasIntegracaoAnalyzerJob", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stageFindManyMock.mockResolvedValue([faturamento]);
        stageDetalhesFindManyMock.mockResolvedValue([faturamentoDetalhe]);
        stageUpdateMock.mockResolvedValue({});
        vendaFindFirstMock.mockResolvedValue(null);
        vendaCreateMock.mockResolvedValue({ id: 1 });
        getPublicUrlMock.mockImplementation(
            (blobName: string) => `https://storage.example.com/${blobName}`,
        );
    });

    it("busca os registros pendentes respeitando o tamanho do lote", async () => {
        await processVendasIntegracaoAnalyzerJob.task();

        expect(stageFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: { StatusRegistro: "1" },
            take: 100,
        }));
    });

    it("continua buscando páginas até processar todos os registros disponíveis", async () => {
        const primeiraPagina = Array.from({ length: 100 }, (_, index) => ({
            ...faturamento,
            Id: new Prisma.Decimal(index + 1),
            NumeroDocumento: `DOC-${index + 1}`,
        }));
        const segundaPagina = [{
            ...faturamento,
            Id: new Prisma.Decimal(101),
            NumeroDocumento: "DOC-101",
        }];
        stageFindManyMock
            .mockResolvedValueOnce(primeiraPagina)
            .mockResolvedValueOnce(segundaPagina);

        const result = await processVendasIntegracaoAnalyzerJob.task();

        expect(stageFindManyMock).toHaveBeenCalledTimes(2);
        expect(stageFindManyMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: {
                StatusRegistro: "1",
                OR: [
                    { OrigemRegistro: { gt: "A" } },
                    {
                        OrigemRegistro: "A",
                        Id: { gt: primeiraPagina[99].Id },
                    },
                ],
            },
            take: 100,
        }));
        expect(result).toEqual({ totalReceived: 101, totalInserted: 101, totalUpdated: 0 });
    });

    it("mapeia o faturamento para vendas_header e marca a origem como integrada", async () => {
        const result = await processVendasIntegracaoAnalyzerJob.task();

        expect(vendaCreateMock).toHaveBeenCalledWith({
            data: {
                tipoCadastro: "ANALYZER",
                status: "PENDENTE",
                ciaIdSAP: "1000",
                codigoClienteAnalyzer: "12345",
                numeroDocumentoAnalyzer: "FAT-001",
                infoReferenciaAnalyzer: "Referência Analyzer",
                valorTotalVendas: "100.5",
                pathArquivoFaturaDetalhadaAnalyzer:
                    "https://storage.example.com/FATURAMENTO/10/fatura-detalhada.xlsx",
                pathArquivoRelatorioAnalitico:
                    "https://storage.example.com/FATURAMENTO/10/relatorio-analitico.pdf",
                dataEmissao: new Date("2026-07-31T00:00:00.000Z"),
                dataLancamentoContabil: new Date("2026-07-31T00:00:00.000Z"),
                dataFechamentoDe: faturamento.PeriodoFechamentoDe,
                dataFechamentoAte: faturamento.PeriodoFechamentoAte,
                cnpjCliente: "12345678000199",
                vendasDetalhe: {
                    create: [{
                        itemDocumento: 10,
                        codigoProdutoDotz: "PONTO-01",
                        descricaoProduto: "Produto de pontos",
                        centroLucro: "CL-01",
                        centroCusto: "CC-01",
                        quantidadePontos: 5000,
                        valorVenda: "61.73",
                        precoUnitario: "0.012345",
                    }],
                },
            },
        });
        expect(stageDetalhesFindManyMock).toHaveBeenCalledWith({
            where: {
                OrigemRegistro: "A",
                FaturamentoId: faturamento.Id,
            },
            orderBy: { Id: "asc" },
        });
        expect(stageUpdateMock).toHaveBeenCalledWith({
            where: {
                OrigemRegistro_Id: {
                    OrigemRegistro: "A",
                    Id: faturamento.Id,
                },
            },
            data: { StatusRegistro: "2" },
        });
        expect(result).toEqual({ totalReceived: 1, totalInserted: 1, totalUpdated: 0 });
    });

    it("não duplica uma venda já importada e conclui o registro pendente", async () => {
        vendaFindFirstMock.mockResolvedValue({ id: 99 });

        const result = await processVendasIntegracaoAnalyzerJob.task();

        expect(vendaCreateMock).not.toHaveBeenCalled();
        expect(stageUpdateMock).toHaveBeenCalledOnce();
        expect(result).toEqual({ totalReceived: 1, totalInserted: 0, totalUpdated: 0 });
    });

    it("mantém StatusRegistro 1 quando a inclusão no S4 falha", async () => {
        vendaCreateMock.mockRejectedValue(new Error("Falha no S4"));

        const result = await processVendasIntegracaoAnalyzerJob.task();

        expect(stageUpdateMock).not.toHaveBeenCalled();
        expect(result).toEqual({ totalReceived: 1, totalInserted: 0, totalUpdated: 0 });
    });
});
