import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindUniqueVenda,
    mockFindFirstCia,
    mockFindUniqueConfig,
    mockFindUniqueParcela,
    mockCreateParcela,
    mockUpdateVenda,
} = vi.hoisted(() => ({
    mockFindUniqueVenda: vi.fn(),
    mockFindFirstCia: vi.fn(),
    mockFindUniqueConfig: vi.fn(),
    mockFindUniqueParcela: vi.fn(),
    mockCreateParcela: vi.fn(),
    mockUpdateVenda: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { findUnique: mockFindUniqueVenda, update: mockUpdateVenda },
        cia: { findFirst: mockFindFirstCia },
        configuracaoContabil: { findUnique: mockFindUniqueConfig },
        vendaRecDiferida: {
            findUnique: mockFindUniqueParcela,
            create: mockCreateParcela,
        },
    },
}));

import { VendaRecDiferidaGerarParcelasService } from "../../../src/modules/vendas/services/VendaRecDiferidaGerarParcelasService";
import AppError from "../../../src/util/AppError";

const baseVenda = {
    id: 1,
    ciaId: 1000,
    status: "AGUARDANDO_BOLETO",
    codigoClienteSAP: "C000001",
    valorTotalVendas: { toFixed: (n: number) => "300.00", toString: () => "300.00" } as any,
    dataEmissao: new Date("2026-01-15T00:00:00.000Z"),
    periodoDeDiferimento: null,
    taxaExpiracao: null,
    valorReceitaVenda: null,
};

const baseCia = { id: 42 };

// Config DR: apenas período de diferimento
const baseConfigDr = { periodoDeDiferimento: 3, taxaExpiracao: { toString: () => "75.0000" } as any };

// Config RD: detalhes contábeis
const baseConfigRd = {
    id: 7,
    tipoContabilERP: "GL",
    textoHeaderContabil: "Receita diferida",
    configuracaoContabilDetalhes: [
        {
            contaCreditoValorProduto: "4000001",
            contaDebitoValorProduto: "1000001",
            centroCusto: null,
            centroLucro: "LP01",
        },
    ],
};

describe("VendaRecDiferidaGerarParcelasService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        mockFindUniqueVenda.mockResolvedValue(null);

        const service = new VendaRecDiferidaGerarParcelasService();
        await expect(service.execute({ vendasHeaderId: 999 })).rejects.toMatchObject({
            message: "Venda não encontrada",
            statusCode: 404,
        });
    });

    it("deve lançar AppError 400 quando venda não tem valorTotalVendas", async () => {
        mockFindUniqueVenda.mockResolvedValue({ ...baseVenda, valorTotalVendas: null });

        const service = new VendaRecDiferidaGerarParcelasService();
        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toMatchObject({
            message: "Venda não possui valor total definido",
            statusCode: 400,
        });
    });

    it("deve lançar AppError quando CIA não encontrada", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(null);

        const service = new VendaRecDiferidaGerarParcelasService();
        await expect(service.execute({ vendasHeaderId: 1 })).rejects.toBeInstanceOf(AppError);
    });

    it("deve retornar zero parcelas quando não existe configuração DR para a CIA", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig.mockResolvedValue(null); // DR retorna null → early return

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.totalParcelas).toBe(0);
        expect(result.parcelas).toHaveLength(0);
        expect(mockCreateParcela).not.toHaveBeenCalled();
    });

    it("deve retornar zero parcelas quando periodoDeDiferimento DR é 0", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig.mockResolvedValue({ periodoDeDiferimento: 0 }); // 0 → early return

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.totalParcelas).toBe(0);
        expect(result.parcelas).toHaveLength(0);
        expect(mockCreateParcela).not.toHaveBeenCalled();
    });

    it("deve retornar zero parcelas quando periodoDeDiferimento DR é null", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig.mockResolvedValue({ periodoDeDiferimento: null }); // null → early return

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.totalParcelas).toBe(0);
        expect(result.parcelas).toHaveLength(0);
        expect(mockCreateParcela).not.toHaveBeenCalled();
    });

    it("deve retornar zero parcelas quando config RD não existe", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        // 1ª chamada (DR) retorna config com período; 2ª chamada (RD) retorna null
        mockFindUniqueConfig
            .mockResolvedValueOnce(baseConfigDr)
            .mockResolvedValueOnce(null);

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.totalParcelas).toBe(0);
        expect(result.parcelas).toHaveLength(0);
        expect(mockCreateParcela).not.toHaveBeenCalled();
    });

    it("deve criar parcelas novas com datas corretas (3 períodos a partir de jan/2026)", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        // 1ª chamada (DR) → período; 2ª chamada (RD) → detalhes contábeis
        mockFindUniqueConfig
            .mockResolvedValueOnce(baseConfigDr)
            .mockResolvedValueOnce(baseConfigRd);
        mockFindUniqueParcela.mockResolvedValue(null);
        mockCreateParcela.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: data.periodoDiferimento * 10, status: "PENDENTE" }),
        );

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.totalParcelas).toBe(3);
        expect(result.parcelas).toHaveLength(6);
        expect(mockCreateParcela).toHaveBeenCalledTimes(6);

        const calls = mockCreateParcela.mock.calls.map((c: any) => c[0].data);

        // Período 1: 2026-02-01
        expect(calls[0].periodoDiferimento).toBe(1);
        expect(calls[0].tipo).toBe("DIFERIDO_TOTAL");
        expect(calls[0].valorDiferimento).toBe(75);
        expect(calls[0].dataDiferimento.getUTCMonth()).toBe(1); // fevereiro
        expect(calls[0].dataDiferimento.getUTCDate()).toBe(1);

        // Período 2: 2026-03-01
        expect(calls[1].dataDiferimento.getUTCMonth()).toBe(2); // março

        // Período 3: 2026-04-01
        expect(calls[2].dataDiferimento.getUTCMonth()).toBe(3); // abril
    });

    it("deve distribuir valor absorvendo arredondamento no último período", async () => {
        const vendaCem = {
            ...baseVenda,
            valorTotalVendas: { toFixed: () => "100.00", toString: () => "100" } as any,
        };
        mockFindUniqueVenda.mockResolvedValue(vendaCem);
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig
            .mockResolvedValueOnce({ ...baseConfigDr, taxaExpiracao: { toString: () => "10.0000" } as any })
            .mockResolvedValueOnce(baseConfigRd);
        mockFindUniqueParcela.mockResolvedValue(null);
        mockCreateParcela.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: data.periodoDiferimento * 10, status: "PENDENTE" }),
        );

        const service = new VendaRecDiferidaGerarParcelasService();
        await service.execute({ vendasHeaderId: 1 });

        const calls = mockCreateParcela.mock.calls.map((c: any) => c[0].data);
        expect(calls[0].valorDiferimento).toBe(3.33);
        expect(calls[1].valorDiferimento).toBe(3.33);
        expect(calls[2].valorDiferimento).toBe(3.34);
    });

    it("deve criar parcelas DIFERIDO_VENDA quando valorReceitaVenda estiver preenchido", async () => {
        mockFindUniqueVenda.mockResolvedValue({
            ...baseVenda,
            valorReceitaVenda: { toString: () => "90.00" } as any,
        });
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig
            .mockResolvedValueOnce(baseConfigDr)
            .mockResolvedValueOnce(baseConfigRd);
        mockFindUniqueParcela.mockResolvedValue(null);
        mockCreateParcela.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: data.periodoDiferimento * 10, status: "PENDENTE" }),
        );

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.parcelas).toHaveLength(6);
        expect(mockCreateParcela).toHaveBeenCalledTimes(6);

        const calls = mockCreateParcela.mock.calls.map((c: any) => c[0].data);
        expect(calls.slice(0, 3).every((p: any) => p.tipo === "DIFERIDO_TOTAL")).toBe(true);
        expect(calls.slice(3).every((p: any) => p.tipo === "DIFERIDO_VENDA")).toBe(true);
        expect(calls[3].valorDiferimento).toBe(30);

        const buscas = mockFindUniqueParcela.mock.calls.map((c: any) => c[0].where);
        expect(buscas[3]).toEqual({
            vendasHeaderId_periodoDiferimento_tipo: {
                vendasHeaderId: 1,
                periodoDiferimento: 1,
                tipo: "DIFERIDO_VENDA",
            },
        });
    });

    it("deve pular criação e retornar parcelas já existentes (idempotência)", async () => {
        mockFindUniqueVenda.mockResolvedValue(baseVenda);
        mockFindFirstCia.mockResolvedValue(baseCia);
        mockFindUniqueConfig
            .mockResolvedValueOnce(baseConfigDr)
            .mockResolvedValueOnce(baseConfigRd);
        mockFindUniqueParcela.mockResolvedValue({ id: 99, status: "INTEGRADO" });

        const service = new VendaRecDiferidaGerarParcelasService();
        const result = await service.execute({ vendasHeaderId: 1 });

        expect(result.parcelas).toHaveLength(6);
        expect(result.parcelas.every((p) => !p.criada)).toBe(true);
        expect(mockCreateParcela).not.toHaveBeenCalled();
    });
});
