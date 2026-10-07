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

import { ItemPOR1Validator } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/ItemPOR1Validator";
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

describe("ItemPOR1Validator", () => {
    let validator: ItemPOR1Validator;

    beforeEach(() => {
        vi.clearAllMocks();
        validator = new ItemPOR1Validator();
    });

    it("deve retornar sem divergências quando item válido", () => {
        const por1Item = criarPOR1Item();
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toHaveLength(0);
    });

    // =========================================================================
    // Código 10 - LineStatus
    // =========================================================================
    it("deve gerar código 10 quando LineStatus não é 'O'", () => {
        const por1Item = criarPOR1Item({ LineStatus: "C" });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "10" }),
            ])
        );
    });

    it("não deve gerar código 10 quando LineStatus é null", () => {
        const por1Item = criarPOR1Item({ LineStatus: null });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        const codigo10 = divergencias.filter((d) => d.code === "10");
        expect(codigo10).toHaveLength(0);
    });

    // =========================================================================
    // Código 12 - U_DocEntryNF (já integrado no SAP)
    // =========================================================================
    it("deve gerar código 12 quando U_DocEntryNF não é null", () => {
        const por1Item = criarPOR1Item({ U_DocEntryNF: 999 });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "12" }),
            ])
        );
    });

    // =========================================================================
    // Código 09 - Preço divergente
    // =========================================================================
    it("deve gerar código 09 quando preço difere", () => {
        const por1Item = criarPOR1Item({ Price: new Prisma.Decimal(100) });
        const row = criarRow({ VLPROD: 50 });

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "09" }),
            ])
        );
    });

    // =========================================================================
    // Código 08 - Quantidade divergente
    // =========================================================================
    it("deve gerar código 08 quando quantidade difere", () => {
        const por1Item = criarPOR1Item({ Quantity: new Prisma.Decimal(20) });
        const row = criarRow({ QTDPROD: 10 });

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "08" }),
            ])
        );
    });

    // =========================================================================
    // Código 11 - NÃO deve mais ser gerado (validação removida)
    // =========================================================================
    it("NÃO deve gerar código 11 quando produto do pedido difere do romaneio", () => {
        const por1Item = criarPOR1Item({ U_PRODUTO: "PROD-PEDIDO" });
        const row = criarRow({ PRODUTO: "PROD-ROMANEIO" });

        const divergencias = validator.validar(por1Item, "PROD-ROMANEIO", row);

        const codigo11 = divergencias.filter((d) => d.code === "11");
        expect(codigo11).toHaveLength(0);
    });

    // =========================================================================
    // Código 15 - OITM não cadastrado
    // =========================================================================
    it("deve gerar código 15 quando OITM é null", () => {
        const por1Item = criarPOR1Item({ OITM: null });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "15" }),
            ])
        );
    });

    it("deve fazer early return quando OITM é null (não valida códigos 16/17)", () => {
        const por1Item = criarPOR1Item({ OITM: null });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        const codigos16e17 = divergencias.filter((d) => d.code === "16" || d.code === "17");
        expect(codigos16e17).toHaveLength(0);
    });

    // =========================================================================
    // Código 16 - Produto deletado
    // =========================================================================
    it("deve gerar código 16 quando produto está deletado", () => {
        const por1Item = criarPOR1Item({
            OITM: {
                ItemCode: "ITM-001",
                Deleted: "Y",
                U_Seidor_PC_Calcula: 1,
                U_Seidor_PC_Analisa: null,
                SuppCatNum: null,
            },
        });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "16" }),
            ])
        );
    });

    // =========================================================================
    // Código 17 - U_Seidor_PC_Calcula inválido
    // =========================================================================
    it("deve gerar código 17 quando U_Seidor_PC_Calcula não é 1 ou 2", () => {
        const por1Item = criarPOR1Item({
            OITM: {
                ItemCode: "ITM-001",
                Deleted: "N",
                U_Seidor_PC_Calcula: 3,
                U_Seidor_PC_Analisa: null,
                SuppCatNum: null,
            },
        });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "17" }),
            ])
        );
    });

    it("deve gerar código 17 quando U_Seidor_PC_Calcula é null", () => {
        const por1Item = criarPOR1Item({
            OITM: {
                ItemCode: "ITM-001",
                Deleted: "N",
                U_Seidor_PC_Calcula: null,
                U_Seidor_PC_Analisa: null,
                SuppCatNum: null,
            },
        });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        expect(divergencias).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "17" }),
            ])
        );
    });

    it("não deve gerar código 17 quando U_Seidor_PC_Calcula é 2", () => {
        const por1Item = criarPOR1Item({
            OITM: {
                ItemCode: "ITM-001",
                Deleted: "N",
                U_Seidor_PC_Calcula: 2,
                U_Seidor_PC_Analisa: null,
                SuppCatNum: null,
            },
        });
        const row = criarRow();

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        const codigo17 = divergencias.filter((d) => d.code === "17");
        expect(codigo17).toHaveLength(0);
    });

    // =========================================================================
    // Múltiplas divergências
    // =========================================================================
    it("deve acumular múltiplas divergências sem bloquear processamento", () => {
        const por1Item = criarPOR1Item({
            LineStatus: "C",
            U_DocEntryNF: 999,
            Price: new Prisma.Decimal(100),
            Quantity: new Prisma.Decimal(20),
        });
        const row = criarRow({ VLPROD: 50, QTDPROD: 10 });

        const divergencias = validator.validar(por1Item, "PROD-001", row);

        const codigos = divergencias.map((d) => d.code);
        expect(codigos).toContain("10"); // LineStatus
        expect(codigos).toContain("12"); // U_DocEntryNF
        expect(codigos).toContain("09"); // Price
        expect(codigos).toContain("08"); // Quantity
    });
});
