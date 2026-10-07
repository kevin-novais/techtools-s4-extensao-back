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

import { ItensPedidoValidator } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/ItensPedidoValidator";
import type { PedidoAnalyzerData, RomaneioRow } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

function criarPOR1Item(overrides: Partial<PedidoAnalyzerData["POR1"][number]> = {}): PedidoAnalyzerData["POR1"][number] {
    return {
        DocEntry: 100,
        Quantity: new Prisma.Decimal(10),
        U_PRODUTO: "PROD-001",
        ItemCode: "ITM-001",
        LineStatus: "O",
        U_DocEntryNF: null,
        Price: new Prisma.Decimal(50),
        OITM: {
            ItemCode: "ITM-001",
            Deleted: "N",
            U_Seidor_PC_Calcula: 1,
            U_Seidor_PC_Analisa: null,
            SuppCatNum: "SUPP-001",
        },
        ...overrides,
    };
}

function criarPedidoAnalyzer(overrides: Partial<PedidoAnalyzerData> = {}): PedidoAnalyzerData {
    return {
        U_DOTZNRPED: 12345,
        CardCode: "F001",
        CANCELED: "N",
        DocStatus: "O",
        DocTotal: new Prisma.Decimal(500),
        OCRD: { CardCode: "F001", ativo: true },
        POR1: [criarPOR1Item()],
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
        VLFRETE: 5,
        COMBO: 0,
        VLRPEDIDO: 500,
        PEDIDO_PARCEIRO: 12345,
        CHAVE_NFE: "CHAVE-001",
        ...overrides,
    };
}

describe("ItensPedidoValidator", () => {
    let validator: ItensPedidoValidator;

    beforeEach(() => {
        vi.clearAllMocks();
        validator = new ItensPedidoValidator();
    });

    it("deve retornar divergência código 07 quando POR1 está vazio", () => {
        const pedido = criarPedidoAnalyzer({ POR1: [] });
        const row = criarRow();

        const resultado = validator.validar(pedido, 12345, row);

        expect(resultado.docEntry).toBeNull();
        expect(resultado.divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "07" }),
            ])
        );
    });

    it("deve retornar divergência código 07 quando POR1 é undefined", () => {
        const pedido = criarPedidoAnalyzer({ POR1: undefined as unknown as PedidoAnalyzerData["POR1"] });
        const row = criarRow();

        const resultado = validator.validar(pedido, 12345, row);

        expect(resultado.docEntry).toBeNull();
        expect(resultado.divergencias).toHaveLength(1);
        expect(resultado.divergencias[0].code).toBe("07");
    });

    it("deve usar POR1[0] independente do valor da coluna PRODUTO do romaneio", () => {
        const pedido = criarPedidoAnalyzer({
            POR1: [criarPOR1Item({ U_PRODUTO: "PROD-PEDIDO", DocEntry: 200 })],
        });
        const row = criarRow({ PRODUTO: "PROD-DIFERENTE" });

        const resultado = validator.validar(pedido, 12345, row);

        expect(resultado.docEntry).toBe("200");
        // Não deve ter divergência código 07 ou 11
        const codigosProduto = resultado.divergencias
            .filter((d) => d.code === "07" || d.code === "11");
        expect(codigosProduto).toHaveLength(0);
    });

    it("deve retornar DocEntry do primeiro item do pedido (POR1[0])", () => {
        const pedido = criarPedidoAnalyzer({
            POR1: [
                criarPOR1Item({ DocEntry: 300, U_PRODUTO: "PROD-A" }),
                criarPOR1Item({ DocEntry: 400, U_PRODUTO: "PROD-B" }),
            ],
        });
        const row = criarRow({ PRODUTO: "PROD-B" });

        const resultado = validator.validar(pedido, 12345, row);

        // Deve usar POR1[0] (DocEntry 300), não POR1[1] que teria match por PRODUTO
        expect(resultado.docEntry).toBe("300");
    });

    it("deve funcionar quando PRODUTO é undefined (coluna opcional no XLSX)", () => {
        const pedido = criarPedidoAnalyzer();
        const row = criarRow({ PRODUTO: undefined as unknown as string });

        const resultado = validator.validar(pedido, 12345, row);

        expect(resultado.docEntry).toBe("100");
        const codigosProduto = resultado.divergencias
            .filter((d) => d.code === "07" || d.code === "11");
        expect(codigosProduto).toHaveLength(0);
    });

    it("deve delegar validações de detalhe para ItemPOR1Validator", () => {
        const pedido = criarPedidoAnalyzer({
            POR1: [criarPOR1Item({ LineStatus: "C" })],
        });
        const row = criarRow();

        const resultado = validator.validar(pedido, 12345, row);

        // ItemPOR1Validator deve gerar código 10 (LineStatus inválido)
        expect(resultado.divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "10" }),
            ])
        );
    });

    it("deve retornar sem divergências quando pedido válido", () => {
        const pedido = criarPedidoAnalyzer();
        const row = criarRow();

        const resultado = validator.validar(pedido, 12345, row);

        expect(resultado.docEntry).toBe("100");
        expect(resultado.divergencias).toHaveLength(0);
    });
});
