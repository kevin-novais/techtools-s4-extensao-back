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

        equals(value: DecimalMock | number | string) {
            return this.value === Number(value);
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

import { PedidoAnalyzerValidator } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/PedidoAnalyzerValidator";
import type { PedidoAnalyzerData, RomaneioRow } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

const FORNECEDOR_HEADER = "F001";
const PEDIDO_PARCEIRO = 12345;

function criarPedidoAnalyzer(overrides: Partial<PedidoAnalyzerData> = {}): PedidoAnalyzerData {
    return {
        U_DOTZNRPED: PEDIDO_PARCEIRO,
        CardCode: FORNECEDOR_HEADER,
        CANCELED: "N",
        DocStatus: "O",
        DocTotal: new Prisma.Decimal(500),
        OCRD: { CardCode: FORNECEDOR_HEADER, ativo: true },
        POR1: [],
        POR2: [],
        ...overrides,
    };
}

function criarRow(overrides: Partial<RomaneioRow> = {}): RomaneioRow {
    return {
        NFVENDA: "NF-001",
        QTDPROD: 10,
        PRODUTO: "PROD-001",
        DESCRICAO: "Produto Teste",
        VLPROD: 50,
        VLFRETE: null,
        COMBO: 0,
        VLRPEDIDO: 500,
        PEDIDO_PARCEIRO,
        CHAVE_NFE: "CHAVE-001",
        ...overrides,
    };
}

describe("PedidoAnalyzerValidator", () => {
    let validator: PedidoAnalyzerValidator;

    beforeEach(() => {
        vi.clearAllMocks();
        validator = new PedidoAnalyzerValidator();
    });

    it("deve retornar divergência código 04 quando VLRPEDIDO difere do DocTotal do pedido", () => {
        const pedido = criarPedidoAnalyzer({ DocTotal: new Prisma.Decimal(500) });
        const row = criarRow({ VLRPEDIDO: 480 });

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "04" })])
        );
    });

    it("não deve gerar divergência quando VLRPEDIDO bate com o DocTotal do pedido", () => {
        const pedido = criarPedidoAnalyzer({ DocTotal: new Prisma.Decimal(500) });
        const row = criarRow({ VLRPEDIDO: 500 });

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual([]);
    });

    it("deve retornar divergência código 01 quando o parceiro do pedido difere do fornecedor do romaneio", () => {
        const pedido = criarPedidoAnalyzer({ CardCode: "F999" });
        const row = criarRow();

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "01" })])
        );
    });

    it("deve retornar divergência código 03 quando o pedido está cancelado", () => {
        const pedido = criarPedidoAnalyzer({ CANCELED: "Y" });
        const row = criarRow();

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "03" })])
        );
    });

    it("deve retornar divergência código 18 quando o pedido não está aberto", () => {
        const pedido = criarPedidoAnalyzer({ DocStatus: "C" });
        const row = criarRow();

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "18" })])
        );
    });

    it("deve retornar divergência código 05 quando o parceiro não está cadastrado", () => {
        const pedido = criarPedidoAnalyzer({ OCRD: null });
        const row = criarRow();

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "05" })])
        );
    });

    it("deve retornar divergência código 14 quando o frete do romaneio difere do frete do pedido", () => {
        const pedido = criarPedidoAnalyzer({ POR2: [{ LineTotal: new Prisma.Decimal(30), ExpnsCode: 1 }] });
        const row = criarRow({ VLFRETE: 5 });

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "14" })])
        );
    });

    it("não deve gerar divergência de frete quando VLFRETE bate com o LineTotal do POR2", () => {
        const pedido = criarPedidoAnalyzer({ POR2: [{ LineTotal: new Prisma.Decimal(3.64), ExpnsCode: 1 }] });
        const row = criarRow({ VLFRETE: 3.64 });

        const resultado = validator.validar(pedido, PEDIDO_PARCEIRO, FORNECEDOR_HEADER, row);

        expect(resultado).toEqual(
            expect.not.arrayContaining([expect.objectContaining({ code: "14" })])
        );
    });
});
