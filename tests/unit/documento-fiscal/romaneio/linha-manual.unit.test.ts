import { describe, expect, it, vi, beforeEach } from "vitest";

const { Prisma } = vi.hoisted(() => {
    class DecimalMock {
        private readonly value: number;

        constructor(value: DecimalMock | number | string) {
            this.value = value instanceof DecimalMock ? Number(value) : Number(value);
        }

        toNumber() {
            return this.value;
        }

        isZero() {
            return this.value === 0;
        }

        equals(value: DecimalMock | number | string) {
            return this.value === Number(value);
        }

        mul(value: DecimalMock | number | string) {
            return new DecimalMock(this.value * Number(value));
        }

        div(value: DecimalMock | number | string) {
            return new DecimalMock(this.value / Number(value));
        }

        toFixed(decimalPlaces: number) {
            return this.value.toFixed(decimalPlaces);
        }

        valueOf() {
            return this.value;
        }
    }

    return {
        Prisma: {
            Decimal: DecimalMock,
        },
    };
});

vi.mock("@prisma/client-s4-dotz", () => ({
    Prisma,
}));

vi.mock("@prisma/client-s4-dotz/runtime/library", () => ({
    Decimal: Prisma.Decimal,
}));

import { ProcessRomaneioDetalheService } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/ProcessRomaneioDetalheService";
import type {
    ConfiguracaoContabilData,
    ConfigDetalhe,
    RomaneioRow,
} from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

const CONTEXTO = {
    documentoFiscalHeaderId: 1,
    codigoDocumento: "3039",
    codigoFornecedorSAPHeader: "F001",
};

function configDetalheBonificacao(): ConfigDetalhe {
    return {
        id: 99,
        grupoPisCofins: "N",
        codigoItem: "BN002",
        validarDivergencia: false,
        aliquotaPis: null,
        aliquotaCofins: null,
        contaCreditoPis: null,
        contaDebitoPis: null,
        contaCreditoCofins: null,
        contaDebitoCofins: null,
        contaCreditoValorProduto: "CRED001",
        contaDebitoValorProduto: "DEB001",
        contaCreditoValorFrete: null,
        contaDebitoValorFrete: null,
        contaCreditoValorCombo: null,
        contaDebitoValorCombo: null,
        contaCreditoValorIs: null,
        contaDebitoValorIs: null,
        contaCreditoValorCbs: null,
        contaDebitoValorCbs: null,
        contaCreditoValorIbsUf: null,
        contaDebitoValorIbsUf: null,
        contaCreditoValorIbsMunicipal: null,
        contaDebitoValorIbsMunicipal: null,
        centroCusto: "CC01",
        centroLucro: "CL01",
    } as unknown as ConfigDetalhe;
}

function criarConfigContabil(): ConfiguracaoContabilData {
    const detalhe = configDetalheBonificacao();
    return {
        header: {
            textoHeaderContabil: "Romaneio",
            periodoDeDiferimento: null,
            tipoContabilERP: "AP",
        },
        configsPorGrupoEItem: new Map([["N|BN002", detalhe]]),
        configsGenericasPorGrupo: new Map(),
        configsPorCodigoProdutoManual: new Map([["BN002", detalhe]]),
    } as unknown as ConfiguracaoContabilData;
}

function criarRow(overrides: Partial<Record<string, unknown>> = {}): RomaneioRow {
    return {
        NFVENDA: 50,
        QTDPROD: 1,
        PRODUTO: "BN002",
        DESCRICAO: "Bonificacao",
        VLPROD: -20,
        VLFRETE: null,
        COMBO: null,
        VLRPEDIDO: -20,
        PEDIDO_PARCEIRO: null,
        CHAVE_NFE: null,
        ...overrides,
    } as unknown as RomaneioRow;
}

/** Invoca o metodo privado processarLinha */
function processarLinha(row: RomaneioRow, config: ConfiguracaoContabilData) {
    const service = new ProcessRomaneioDetalheService();
    return (service as any).processarLinha(row, new Map(), new Set(), config, CONTEXTO, 1);
}

describe("ProcessRomaneioDetalheService - linhas extras (bonificacao/desconto)", () => {
    let config: ConfiguracaoContabilData;

    beforeEach(() => {
        config = criarConfigContabil();
    });

    it("trata bonificacao com VLRPEDIDO negativo como linha manual (sem divergencia)", () => {
        // Caso real do romaneio 3039: a bonificacao vem com valor negativo preenchido
        const detalhe = processarLinha(criarRow(), config);

        expect(detalhe.divergencias).toBe(false);
        expect(detalhe.erros).toEqual([]);
        expect(detalhe.configuracaoContabilDetalheId).toBe(99);
        // valorPedido fica null: o LCM usa `valorPedido ?? valorProduto` para linhas manuais
        expect(detalhe.valorPedido).toBeNull();
        expect(detalhe.valorProduto).toBe(-20);
    });

    it("aplica na linha manual as contas do cadastro do item (BN002), gerando lancamento proprio no LCM", () => {
        const detalhe = processarLinha(criarRow(), config);

        expect(detalhe.contaContabilDebitoCusto).toBe("DEB001");
        expect(detalhe.contaContabilCreditoCusto).toBe("CRED001");
        expect(detalhe.centroCusto).toBe("CC01");
        expect(detalhe.centroLucro).toBe("CL01");
    });

    it("ignora espaco nao-quebravel (U+00A0) no codigo do produto", () => {
        const detalhe = processarLinha(criarRow({ PRODUTO: "BN002 " }), config);

        expect(detalhe.divergencias).toBe(false);
        expect(detalhe.codigoProdutoRomaneio).toBe("BN002");
    });

    it("mantem linha manual quando VLRPEDIDO vem vazio", () => {
        const detalhe = processarLinha(criarRow({ VLRPEDIDO: null }), config);

        expect(detalhe.divergencias).toBe(false);
        expect(detalhe.configuracaoContabilDetalheId).toBe(99);
    });

    it("linha sem config manual segue o fluxo normal e acusa divergencia", () => {
        const detalhe = processarLinha(
            criarRow({ PRODUTO: "SC9436", VLPROD: 14.9, VLRPEDIDO: 14.9, PEDIDO_PARCEIRO: 272503580 }),
            config
        );

        expect(detalhe.divergencias).toBe(true);
        expect(detalhe.erros.some((e: { code: string }) => e.code === "00")).toBe(true);
    });
});
