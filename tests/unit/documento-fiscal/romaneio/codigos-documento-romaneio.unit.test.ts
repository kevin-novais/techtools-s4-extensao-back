import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import AppError from "../../../../src/util/AppError";
import {
    extrairCodigosDocumento,
    filtrarLinhasPorDocumento,
    normalizarCodigoDocumento,
} from "../../../../src/modules/documento-fiscal/utils/codigosDocumentoRomaneio";
import type { RomaneioRow } from "../../../../src/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

function criarWorksheet(linhas: Record<string, unknown>[]): XLSX.WorkSheet {
    return XLSX.utils.json_to_sheet(linhas);
}

function linha(nfvenda: unknown, produto = "SC9436", pedido: number | null = 271439801) {
    return {
        NFVENDA: nfvenda,
        QTDPROD: 1,
        PRODUTO: produto,
        DESCRICAO: "Produto",
        VLPROD: 10,
        VLRPEDIDO: 10,
        PEDIDO_PARCEIRO: pedido,
    };
}

describe("extrairCodigosDocumento", () => {
    it("retorna os codigos distintos na ordem de aparicao", () => {
        const worksheet = criarWorksheet([
            linha(20),
            linha(20),
            linha(30),
            linha(50),
            linha(30),
        ]);

        expect(extrairCodigosDocumento(worksheet, "NFVENDA")).toEqual(["20", "30", "50"]);
    });

    it("retorna um unico codigo quando o arquivo tem so um documento", () => {
        const worksheet = criarWorksheet([linha(20), linha(20)]);

        expect(extrairCodigosDocumento(worksheet, "NFVENDA")).toEqual(["20"]);
    });

    it("normaliza espacos ao redor do codigo", () => {
        const worksheet = criarWorksheet([linha(" 20 "), linha("20")]);

        expect(extrairCodigosDocumento(worksheet, "NFVENDA")).toEqual(["20"]);
    });

    it("rejeita planilha com linha sem codigo (nao pertenceria a nenhum documento)", () => {
        const worksheet = criarWorksheet([linha(20), linha("")]);

        expect(() => extrairCodigosDocumento(worksheet, "NFVENDA")).toThrow(AppError);
        expect(() => extrairCodigosDocumento(worksheet, "NFVENDA")).toThrow(/1 linha\(s\) sem código/);
    });

    it("rejeita planilha vazia", () => {
        expect(() => extrairCodigosDocumento(criarWorksheet([]), "NFVENDA")).toThrow(
            "Planilha não contém dados"
        );
    });
});

describe("filtrarLinhasPorDocumento", () => {
    const rows = [
        linha(20, "SC9436"),
        linha(30, "SD1686"),
        linha(20, "SA8444"),
        linha(50, "BN002", null),
    ] as unknown as RomaneioRow[];

    it("mantem apenas as linhas do documento informado", () => {
        const filtradas = filtrarLinhasPorDocumento(rows, "20");

        expect(filtradas).toHaveLength(2);
        expect(filtradas.map((r) => r.PRODUTO)).toEqual(["SC9436", "SA8444"]);
    });

    it("inclui a linha manual (sem pedido) do documento", () => {
        const filtradas = filtrarLinhasPorDocumento(rows, "50");

        expect(filtradas).toHaveLength(1);
        expect(filtradas[0].PRODUTO).toBe("BN002");
    });

    it("retorna vazio quando o documento nao esta no arquivo", () => {
        expect(filtrarLinhasPorDocumento(rows, "99")).toEqual([]);
    });

    it("compara ignorando espacos e tipo (numero x texto)", () => {
        const linhas = [linha(20)] as unknown as RomaneioRow[];

        expect(filtrarLinhasPorDocumento(linhas, " 20 ")).toHaveLength(1);
    });
});

describe("normalizarCodigoDocumento", () => {
    it("converte para texto sem espacos nas pontas", () => {
        expect(normalizarCodigoDocumento(" 20 ")).toBe("20");
        expect(normalizarCodigoDocumento(20)).toBe("20");
    });

    it("trata nulo e indefinido como vazio", () => {
        expect(normalizarCodigoDocumento(null)).toBe("");
        expect(normalizarCodigoDocumento(undefined)).toBe("");
    });
});
