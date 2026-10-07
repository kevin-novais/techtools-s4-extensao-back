import { describe, expect, it } from "vitest";
import { buildLcmFromMovimentos, marcarTextoSaida } from "@/cron/modules/xtpg-saida/mappers/buildLcmFromMovimentos";
import type {
    LoteParContabil,
    MovimentoContabilXtpg,
} from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

function mov(overrides: Partial<MovimentoContabilXtpg>): MovimentoContabilXtpg {
    return {
        pfjCodigo: "1",
        parContabil: "3962",
        data: "2026-07-02",
        indCodigo: "",
        contaContabil: "B1AAA",
        creditoDebito: "D",
        valor: "100",
        lote: "1",
        historico: "",
        banCodigo: "",
        ageCodigo: "",
        cntCodigo: "",
        mvtContador: "1",
        extras: {},
        ...overrides,
    };
}

const configuracao = { tipoArApGl: "GL", tipoDocumento: "AB", textoDocumento: "Xtpg " };

describe("buildLcmFromMovimentos - DTZ-247 centro de custo/lucro", () => {
    it("preenche centroCusto/centroLucro por conta quando cadastrados, e omite quando não", () => {
        const lote: LoteParContabil = {
            parContabil: "3962",
            pfjCodigo: "1",
            data: "2026-07-02",
            lote: "1",
            movimentos: [
                mov({ contaContabil: "B1AAA", creditoDebito: "D", valor: "100", mvtContador: "1" }),
                mov({ contaContabil: "B1BBB", creditoDebito: "C", valor: "40", mvtContador: "2" }),
            ],
        };

        const contaS4PorContaB1 = new Map<string, string>([
            ["B1AAA", "S4AAA"],
            ["B1BBB", "S4BBB"],
        ]);
        const centrosPorContaS4 = new Map([
            ["S4AAA", { centroCusto: "CC01", centroLucro: "CL01" }],
            // S4BBB sem centros cadastrados
        ]);

        const json = buildLcmFromMovimentos({
            lote,
            codigoCia: "1410",
            configuracao,
            contaS4PorContaB1,
            centrosPorContaS4,
            usuarioLancamento: "USER",
        });

        const linhaAAA = json.lancamentosContabeis.find((l) => l.conta === "S4AAA");
        const linhaBBB = json.lancamentosContabeis.find((l) => l.conta === "S4BBB");

        expect(linhaAAA).toMatchObject({ conta: "S4AAA", valor: 100, centroCusto: "CC01", centroLucro: "CL01" });
        expect(linhaBBB).toMatchObject({ conta: "S4BBB", valor: -40 });
        expect(linhaBBB).not.toHaveProperty("centroCusto");
        expect(linhaBBB).not.toHaveProperty("centroLucro");
    });

    it("sem o mapa de centros, mantém as linhas apenas com conta/valor (compatível)", () => {
        const lote: LoteParContabil = {
            parContabil: "3962",
            pfjCodigo: "1",
            data: "2026-07-02",
            lote: "1",
            movimentos: [mov({ contaContabil: "B1AAA", creditoDebito: "D", valor: "100" })],
        };

        const json = buildLcmFromMovimentos({
            lote,
            codigoCia: "1410",
            configuracao,
            contaS4PorContaB1: new Map([["B1AAA", "S4AAA"]]),
            usuarioLancamento: "USER",
        });

        expect(json.lancamentosContabeis[0]).toMatchObject({ conta: "S4AAA", valor: 100 });
        expect(json.lancamentosContabeis[0]).not.toHaveProperty("centroCusto");
    });

    it("marca o texto do header do LCM da saída com 'XTPG ' (DTZ-302)", () => {
        const lote: LoteParContabil = {
            parContabil: "3962", pfjCodigo: "1", data: "2026-07-02", lote: "1",
            movimentos: [mov({ contaContabil: "B1AAA", creditoDebito: "D", valor: "100" })],
        };
        const json = buildLcmFromMovimentos({
            lote, codigoCia: "1410", configuracao,
            contaS4PorContaB1: new Map([["B1AAA", "S4AAA"]]), usuarioLancamento: "USER",
        });
        expect(json.textoDocumento.startsWith("XTPG ")).toBe(true);
    });
});

describe("marcarTextoSaida (DTZ-302)", () => {
    it("prefixa 'XTPG ' e trunca em 25 chars", () => {
        expect(marcarTextoSaida("Lancamentos bancarios")).toBe("XTPG Lancamentos bancario");
        expect(marcarTextoSaida("EST 0100000039")).toBe("XTPG EST 0100000039");
    });
    it("é idempotente (não duplica a marca)", () => {
        expect(marcarTextoSaida("XTPG EST 019")).toBe("XTPG EST 019");
    });
    it("trata texto vazio/nulo", () => {
        expect(marcarTextoSaida("")).toBe("XTPG");
        expect(marcarTextoSaida(null)).toBe("XTPG");
    });
});
