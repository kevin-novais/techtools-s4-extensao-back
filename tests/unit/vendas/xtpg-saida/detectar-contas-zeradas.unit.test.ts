import { describe, expect, it } from "vitest";
import {
    agregarPorConta,
    detectarContasZeradas,
} from "@/cron/modules/xtpg-saida/mappers/buildLcmFromMovimentos";
import type { MovimentoContabilXtpg } from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

function mov(overrides: Partial<MovimentoContabilXtpg>): MovimentoContabilXtpg {
    return {
        pfjCodigo: "1",
        parContabil: "4068",
        data: "2026-08-18",
        indCodigo: "",
        contaContabil: "22510061",
        creditoDebito: "D",
        valor: "0",
        lote: "040120260820171939",
        historico: "",
        banCodigo: "",
        ageCodigo: "",
        cntCodigo: "",
        mvtContador: "1",
        extras: {},
        ...overrides,
    };
}

describe("detectarContasZeradas - lançamento na mesma conta (Marco 21/08)", () => {
    it("acusa a conta quando débito e crédito caem na mesma conta S/4 (PAR 4068)", () => {
        // Cenário real do lote 040120260820171939: D e C de 35.717,73 na mesma conta.
        const linhas = agregarPorConta(
            [
                mov({ creditoDebito: "D", valor: "35717.73", mvtContador: "1" }),
                mov({ creditoDebito: "C", valor: "35717.73", mvtContador: "2" }),
            ],
            new Map([["22510061", "22510061"]]),
        );

        expect(detectarContasZeradas(linhas)).toEqual(["22510061"]);
    });

    it("não acusa quando débito e crédito estão em contas diferentes (PAR 4067)", () => {
        const linhas = agregarPorConta(
            [
                mov({ contaContabil: "29130055", creditoDebito: "D", valor: "1578811.17", mvtContador: "1" }),
                mov({ contaContabil: "22510061", creditoDebito: "C", valor: "1578811.17", mvtContador: "2" }),
            ],
            new Map([
                ["29130055", "29130055"],
                ["22510061", "22510061"],
            ]),
        );

        expect(detectarContasZeradas(linhas)).toEqual([]);
    });

    it("acusa só a conta que zera num lançamento com outras contas válidas", () => {
        const linhas = agregarPorConta(
            [
                mov({ contaContabil: "AAA", creditoDebito: "D", valor: "100", mvtContador: "1" }),
                mov({ contaContabil: "AAA", creditoDebito: "C", valor: "100", mvtContador: "2" }),
                mov({ contaContabil: "BBB", creditoDebito: "D", valor: "50", mvtContador: "3" }),
            ],
            new Map([
                ["AAA", "AAA"],
                ["BBB", "BBB"],
            ]),
        );

        expect(detectarContasZeradas(linhas)).toEqual(["AAA"]);
    });
});
