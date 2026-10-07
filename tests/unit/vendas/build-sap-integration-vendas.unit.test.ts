import { describe, expect, it, vi, beforeEach } from "vitest";
import AppError from "../../../src/util/AppError";

const { mockFindFirstOcrd, Decimal } = vi.hoisted(() => {
    class DecimalMock {
        private readonly value: number;

        constructor(value: DecimalMock | number | string) {
            this.value = value instanceof DecimalMock ? Number(value) : Number(value);
        }

        add(value: DecimalMock | number | string) {
            return new DecimalMock(this.value + Number(value));
        }

        minus(value: DecimalMock | number | string) {
            return new DecimalMock(this.value - Number(value));
        }

        mul(value: DecimalMock | number | string) {
            return new DecimalMock(this.value * Number(value));
        }

        div(value: DecimalMock | number | string) {
            return new DecimalMock(this.value / Number(value));
        }

        toDecimalPlaces(decimalPlaces: number) {
            const factor = 10 ** decimalPlaces;
            return new DecimalMock(Math.round(this.value * factor) / factor);
        }

        valueOf() {
            return this.value;
        }

        toString() {
            return String(this.value);
        }

        toJSON() {
            return this.value;
        }
    }

    return {
        mockFindFirstOcrd: vi.fn(),
        Decimal: DecimalMock,
    };
});

vi.mock("@prisma/client-s4-dotz", () => ({
    Prisma: {
        Decimal,
        validator: () => (value: unknown) => value,
    },
}));

vi.mock("@prisma/client-s4-dotz/runtime/library", () => ({
    Decimal,
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        cia: {
            findFirst: vi.fn(),
        },
        configuracaoContabil: {
            findUnique: vi.fn(),
        },
        configuracaoContabilDetalhe: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("../../../src/database/clients/dotzStageClient", () => ({
    default: () => ({
        oCRD: {
            findFirst: mockFindFirstOcrd,
        },
    }),
}));

vi.mock("../../../src/util/file-url", () => ({
    buildPublicFileUrl: vi.fn((url: string | null) => {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        return `http://localhost:5858${url.startsWith("/") ? url : `/${url}`}`;
    }),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { BuildSapIntegrationVendas } from "../../../src/modules/vendas/utils/BuildSapIntegrationVendas";
import { Config } from "../../../src/config/config";

// ---- Helpers de mock ----

function createMockVenda(overrides: Record<string, any> = {}) {
    return {
        id: 1,
        ciaIdSAP: "1000",
        status: "PENDENTE",
        codigoClienteAnalyzer: "100001",
        cnpjCliente: "12345678000190",
        codigoClienteSAP: "C000001",
        numeroDocumentoAnalyzer: "00009826",
        infoReferenciaAnalyzer: "PERIODO DE FATURAMENTO : JANEIRO/2026.",
        valorTotalVendas: new Decimal(1176.00),
        pathArquivoFaturaDetalhadaAnalyzer: null,
        pathArquivoRelatorioAnalitico: null,
        dataEmissao: new Date("2026-02-02T00:00:00.000Z"),
        dataLancamentoContabil: new Date("2026-02-02T00:00:00.000Z"),
        dataVencimento: new Date("2026-02-22T00:00:00.000Z"),
        vendasDetalhe: [
            {
                id: 1,
                itemDocumento: 1,
                codigoProdutoDotz: "DOTZ001",
                centroLucro: "CL001",
                quantidadePontos: 56000,
                valorVenda: new Decimal(1176.00),
                precoUnitario: new Decimal(0.021),
                custoPontos: new Decimal(940.80),
            },
        ],
        ...overrides,
    };
}

function createMockCia(overrides: Record<string, any> = {}) {
    return {
        id: 5,
        ciaIdSAP: "1000",
        ...overrides,
    };
}

function createMockConfigContabil(overrides: Record<string, any> = {}) {
    return {
        id: 10,
        textoHeaderContabil: "Lançamento contábil - Venda de pontos",
        tipoContabilERP: "AR",
        tipoProcesso: "DR",
        periodoDeDiferimento: 12,
        taxaExpiracao: new Decimal(0.75),
        configuracaoContabilDetalhesPonto: createMockConfigDetalhes(),
        ...overrides,
    };
}

function createMockConfigDetalhes() {
    return [
        {
            codigoPonto: "DOTZ001",
            ehPadrao: true,
            contaCreditoReceitaExpiracao: "4.1.01",
            contaCreditoReceitaVendas: "4.1.02",
            contaCreditoReceitaResgate: "4.1.03",
            grupoPisCofins: "N",
            aliquotaPis: new Decimal(0),
            aliquotaCofins: new Decimal(0),
            contaCreditoPis: null,
            contaDebitoPis: null,
            contaCreditoCofins: null,
            contaDebitoCofins: null,
            centroCusto: "CC_DEFAULT",
            centroLucro: "CL001",
        },
    ];
}

function setupSuccessfulMocks(vendaOverrides: Record<string, any> = {}) {
    vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
        createMockVenda(vendaOverrides) as any,
    );
    vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(
        createMockConfigContabil() as any,
    );
    vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
    mockFindFirstOcrd.mockResolvedValue({ CardCode: "C000001" });
}

describe("BuildSapIntegrationVendas", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirstOcrd.mockReset();
        mockFindFirstOcrd.mockResolvedValue({ CardCode: "C000001" });
    });

    // ---- Validações (early returns) ----

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(null);

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 999 })).rejects.toMatchObject({
            message: "Venda não encontrada",
            statusCode: 404,
        });
    });

    it("deve lançar AppError 400 quando venda não possui codigoClienteAnalyzer", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda({ codigoClienteAnalyzer: null }) as any,
        );

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: "Venda não possui código de cliente Analyzer definido",
            statusCode: 400,
        });
    });

    it("deve gerar integração com dataVencimento vazia quando a venda não possui vencimento", async () => {
        setupSuccessfulMocks({ dataVencimento: null });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].dataVencimento).toBe("");
    });

    it("deve lançar AppError 400 quando venda não possui detalhes", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda({ vendasDetalhe: [] }) as any,
        );

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: "Venda não possui detalhes para processar",
            statusCode: 400,
        });
    });

    it("deve lançar AppError 400 quando CIA não encontrada pelo ciaIdSAP", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda() as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(null);

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: expect.stringContaining("CIA com ciaIdSAP"),
            statusCode: 400,
        });
    });

    it("deve lançar AppError 404 quando configuração contábil DR não encontrada", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda() as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
        vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: expect.stringContaining("Configuração contábil não encontrada"),
            statusCode: 404,
        });
    });

    it("deve lançar AppError 400 quando codigoClienteAnalyzer não é numérico para OCRD", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda({ codigoClienteAnalyzer: "A000001" }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
        vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(
            createMockConfigContabil() as any,
        );
        vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findMany).mockResolvedValue(
            createMockConfigDetalhes() as any,
        );

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: expect.stringContaining("Código de cliente Analyzer inválido"),
            statusCode: 400,
        });
    });

    it("deve lançar AppError 404 quando CardCode não é encontrado na OCRD pelo U_CODDOTZ", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda() as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
        vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(
            createMockConfigContabil() as any,
        );
        vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findMany).mockResolvedValue(
            createMockConfigDetalhes() as any,
        );
        mockFindFirstOcrd.mockResolvedValue(null);

        const service = new BuildSapIntegrationVendas();

        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: expect.stringContaining("Cliente SAP não encontrado na OCRD"),
            statusCode: 404,
        });
    });

    // ---- Fluxo de sucesso ----

    it("deve gerar JSON de integração SAP com sucesso", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result).toHaveLength(1);

        const json = result[0];
        expect(json.tipoArApGl).toBe("AR");
        expect(json.tipoDocumento).toBe("DR");
        expect(json.codigoCia).toBe("1000");
        expect(json.codigoParceiro).toBe("C000001");
        expect(json.numeroDocumento).toBe("00009826");
        expect(json.valorDocumento).toBe(1176.00);
        expect(json.dataEmissao).toBe("2026-02-02");
        expect(json.dataVencimento).toBe("2026-02-22");
        expect(json.dataLancamento).toBe("2026-02-02");
        expect(json.usuarioLancamento).toBe(Config.S4_HANA_CLOUD_USER_NAME);
        expect(json.condicaoPagto).toBe("");
    });

    it("deve buscar CardCode na OCRD usando U_CODDOTZ do codigoClienteAnalyzer", async () => {
        setupSuccessfulMocks({ codigoClienteAnalyzer: "100001", codigoClienteSAP: "IGNORAR" });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(mockFindFirstOcrd).toHaveBeenCalledWith({
            where: {
                U_CODDOTZ: 100001,
                cnpj: "12345678000190",
                ativo: true,
            },
            select: {
                CardCode: true,
            },
            orderBy: {
                UpdateDate: "desc",
            },
        });
        expect(result[0].codigoParceiro).toBe("C000001");
    });

    it("deve usar textoHeaderContabil da configuração quando disponível", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].textoDocumento).toBe("Lançamento contábil - Venda de pontos");
    });

    it("deve usar texto padrão quando textoHeaderContabil é null", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda() as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
        vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(
            createMockConfigContabil({ textoHeaderContabil: null }) as any,
        );
        vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findMany).mockResolvedValue(
            createMockConfigDetalhes() as any,
        );
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].textoDocumento).toBe("Lançamento contábil - Venda de pontos");
    });

    it("deve usar DR-{id} como numeroDocumento quando numeroDocumentoAnalyzer é null", async () => {
        setupSuccessfulMocks({ numeroDocumentoAnalyzer: null });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].numeroDocumento).toBe("DR-1");
    });

    // ---- Lançamentos contábeis ----

    it("deve gerar lançamentos contábeis de receitas calculadas", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const lancamentos = result[0].lancamentosContabeis;
        expect(lancamentos.map((l) => l.conta)).toEqual(["4.1.01", "4.1.02", "4.1.03"]);
        expect(lancamentos.every(l => l.centroCusto === "CC_DEFAULT")).toBe(true);

        const receitaExpiracao = lancamentos.find(l => l.conta === "4.1.01");
        expect(receitaExpiracao).toBeDefined();
        expect(receitaExpiracao!.valor).toBeCloseTo(-8.82, 2);
    });

    it("deve usar centroLucro da config quando detalhe não possui", async () => {
        setupSuccessfulMocks({
            vendasDetalhe: [
                {
                    id: 1,
                    itemDocumento: 1,
                    codigoProdutoDotz: "DOTZ001",
                    centroLucro: null, // sem centro de lucro no detalhe
                    quantidadePontos: 1000,
                    valorVenda: new Decimal(500.00),
                    precoUnitario: new Decimal(0.50),
                    custoPontos: new Decimal(400.00),
                },
            ],
        });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const lancamentos = result[0].lancamentosContabeis;
        // Deve usar CL001 da config
        expect(lancamentos.some(l => l.centroLucro === "CL001")).toBe(true);
        expect(lancamentos.every(l => l.centroCusto === "CC_DEFAULT")).toBe(true);
    });

    it("deve acumular lançamentos contábeis de múltiplos detalhes na mesma conta", async () => {
        setupSuccessfulMocks({
            valorTotalVendas: new Decimal(2000.00),
            vendasDetalhe: [
                {
                    id: 1,
                    itemDocumento: 1,
                    codigoProdutoDotz: "DOTZ001",
                    centroLucro: "CL001",
                    quantidadePontos: 1000,
                    valorVenda: new Decimal(800.00),
                    precoUnitario: new Decimal(0.80),
                    custoPontos: new Decimal(640.00),
                },
                {
                    id: 2,
                    itemDocumento: 2,
                    codigoProdutoDotz: "DOTZ001",
                    centroLucro: "CL001",
                    quantidadePontos: 1500,
                    valorVenda: new Decimal(1200.00),
                    precoUnitario: new Decimal(0.80),
                    custoPontos: new Decimal(960.00),
                },
            ],
        });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const lancamentos = result[0].lancamentosContabeis;
        const receitaExpiracao = lancamentos.find(l => l.conta === "4.1.01");
        expect(receitaExpiracao).toBeDefined();
        // A conta de receita de expiração acumula os dois detalhes na mesma conta.
        expect(receitaExpiracao!.valor).toBeCloseTo(-15.2, 2);
    });

    it("deve usar config padrão quando produto não tem config específica", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            createMockVenda({
                vendasDetalhe: [
                    {
                        id: 1,
                        itemDocumento: 1,
                        codigoProdutoDotz: "PRODUTO_SEM_CONFIG",
                        centroLucro: "CL001",
                        quantidadePontos: 1000,
                        valorVenda: new Decimal(500.00),
                        precoUnitario: new Decimal(0.50),
                        custoPontos: new Decimal(400.00),
                    },
                ],
            }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(createMockCia() as any);
        vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(
            createMockConfigContabil({
                configuracaoContabilDetalhesPonto: [
                    {
                        codigoPonto: null,
                        ehPadrao: true,
                        contaCreditoReceitaExpiracao: "4.1.97",
                        contaCreditoReceitaVendas: "4.1.98",
                        contaCreditoReceitaResgate: "4.1.99",
                        grupoPisCofins: "N",
                        aliquotaPis: new Decimal(0),
                        aliquotaCofins: new Decimal(0),
                        contaCreditoPis: null,
                        contaDebitoPis: null,
                        contaCreditoCofins: null,
                        contaDebitoCofins: null,
                        centroCusto: "CC_PADRAO",
                        centroLucro: null,
                    },
                ],
            }) as any,
        );
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const lancamentos = result[0].lancamentosContabeis;
        expect(lancamentos.some(l => l.conta === "4.1.97")).toBe(true);
        expect(lancamentos.some(l => l.conta === "4.1.98")).toBe(true);
        expect(lancamentos.some(l => l.conta === "4.1.99")).toBe(true);
    });

    // ---- Valor do documento ----

    it("deve calcular valorDocumento pelos detalhes mesmo quando valorTotalVendas do header existe", async () => {
        setupSuccessfulMocks({ valorTotalVendas: new Decimal(5000.00) });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].valorDocumento).toBe(1176.00);
    });

    it("deve somar valorVenda dos detalhes quando valorTotalVendas é null", async () => {
        setupSuccessfulMocks({
            valorTotalVendas: null,
            vendasDetalhe: [
                {
                    id: 1, itemDocumento: 1, codigoProdutoDotz: "DOTZ001",
                    centroLucro: "CL001", quantidadePontos: 100,
                    valorVenda: new Decimal(300.00), precoUnitario: new Decimal(3.00),
                    custoPontos: new Decimal(240.00),
                },
                {
                    id: 2, itemDocumento: 2, codigoProdutoDotz: "DOTZ001",
                    centroLucro: "CL001", quantidadePontos: 200,
                    valorVenda: new Decimal(700.00), precoUnitario: new Decimal(3.50),
                    custoPontos: new Decimal(560.00),
                },
            ],
        });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result[0].valorDocumento).toBe(1000.00);
    });

    // ---- Anexos ----

    it("deve incluir anexos do analyzer quando paths existem", async () => {
        setupSuccessfulMocks({
            pathArquivoFaturaDetalhadaAnalyzer: "/uploads/fatura-detalhada.pdf",
            pathArquivoRelatorioAnalitico: "/uploads/relatorio-analitico.pdf",
        });

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const anexos = result[0].anexos;
        expect(anexos.find(a => a.nomeAnexo === "FATURA_DETALHADA")).toBeDefined();
        expect(anexos.find(a => a.nomeAnexo === "RELATORIO_ANALITICO")).toBeDefined();
        expect(anexos).toHaveLength(2); // apenas anexos do analyzer
    });

    it("deve não incluir anexos quando paths são null", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        const result = await service.execute({ vendasHeaderId: 1 });

        const anexos = result[0].anexos;
        expect(anexos).toHaveLength(0); // relatórios não são mais incluídos no JSON de integração
    });

    // ---- Persistência ----

    it("deve persistir JSON de integração no banco", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        await service.execute({ vendasHeaderId: 1 });

        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    documentoJson: expect.any(String),
                    tipoContabilERP: "AR",
                    tipoProcesso: "DR",
                    periodoDeDiferimento: 12,
                    taxaExpiracao: new Decimal(0.75),
                }),
            }),
        );
    });

    it("deve buscar configuração contábil com tipoProcesso DR", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        await service.execute({ vendasHeaderId: 1 });

        expect(s4DotzClient.configuracaoContabil.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    ciaId_tipoProcesso: {
                        ciaId: 5, // id da CIA, não ciaIdSAP
                        tipoProcesso: "DR",
                    },
                },
            }),
        );
    });

    it("deve buscar CIA pelo ciaIdSAP convertido para string", async () => {
        setupSuccessfulMocks();

        const service = new BuildSapIntegrationVendas();
        await service.execute({ vendasHeaderId: 1 });

        expect(s4DotzClient.cia.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    ciaIdSAP: "1000",
                    deletadoEm: null,
                },
            }),
        );
    });
});
