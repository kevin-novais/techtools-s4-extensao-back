import { describe, expect, it } from "vitest";
import {
    agruparPorLote,
    decidirCancelamentoLote,
    selecionarParaEstorno,
    type PreparoPar,
    type ResultadoIntegracaoSap,
} from "@/cron/modules/xtpg-saida/services/ProcessarSaidaXtpgService";
import type { LoteParContabil } from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

function par(overrides: Partial<LoteParContabil>): LoteParContabil {
    return {
        parContabil: "4067",
        pfjCodigo: "0101",
        data: "2026-08-20",
        lote: "040120260820171939",
        movimentos: [],
        ...overrides,
    };
}

function prep(overrides: Partial<PreparoPar>): PreparoPar {
    return {
        lote: par({}),
        headerId: 1,
        chaveValidacao: "0101-4067",
        integracaoJson: null,
        descricaoErro: null,
        jaIntegrado: false,
        ...overrides,
    };
}

describe("agruparPorLote (DTZ-302)", () => {
    it("agrupa PARs do mesmo lote em um único grupo", () => {
        const grupos = agruparPorLote([
            par({ parContabil: "4067", lote: "L1" }),
            par({ parContabil: "4068", lote: "L1" }),
            par({ parContabil: "4069", lote: "L1" }),
        ]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0]).toHaveLength(3);
    });

    it("separa PARs de lotes diferentes", () => {
        const grupos = agruparPorLote([
            par({ parContabil: "4067", lote: "L1" }),
            par({ parContabil: "5001", lote: "L2" }),
        ]);
        expect(grupos).toHaveLength(2);
    });

    it("PARs com lote vazio caem em grupos individuais (sem atomicidade cruzada)", () => {
        const grupos = agruparPorLote([
            par({ parContabil: "A", lote: "" }),
            par({ parContabil: "B", lote: "   " }),
        ]);
        expect(grupos).toHaveLength(2);
        expect(grupos.every((g) => g.length === 1)).toBe(true);
    });
});

describe("decidirCancelamentoLote (DTZ-302)", () => {
    it("não cancela quando todos os PARs pendentes estão ok", () => {
        const d = decidirCancelamentoLote([prep({}), prep({ chaveValidacao: "0101-4068" })]);
        expect(d.cancelar).toBe(false);
    });

    it("cancela o lote quando um PAR pendente tem erro", () => {
        const d = decidirCancelamentoLote([
            prep({ lote: par({ parContabil: "4067" }), descricaoErro: null }),
            prep({ lote: par({ parContabil: "4068" }), descricaoErro: "Conta não mapeada" }),
        ]);
        expect(d.cancelar).toBe(true);
        expect(d.parComErro).toBe("4068");
        expect(d.motivo).toBe("Conta não mapeada");
    });

    it("ignora PARs já integrados (não disparam cancelamento)", () => {
        const d = decidirCancelamentoLote([
            prep({ jaIntegrado: true, descricaoErro: null }),
            prep({ jaIntegrado: false, descricaoErro: null }),
        ]);
        expect(d.cancelar).toBe(false);
    });
});

describe("selecionarParaEstorno (DTZ-302, Marco 26/08)", () => {
    function res(o: Partial<ResultadoIntegracaoSap>): ResultadoIntegracaoSap {
        return { prep: prep({}), sucesso: false, codigoSap: null, erro: null, ...o };
    }
    it("estorna só os PARs integrados com nº de LCM (os que falharam ficam de fora)", () => {
        const r = selecionarParaEstorno([
            res({ sucesso: true, codigoSap: "019" }),
            res({ sucesso: true, codigoSap: "020" }),
            res({ sucesso: false, codigoSap: null, erro: "HTTP 400" }), // o que falhou
        ]);
        expect(r.map((x) => x.codigoSap)).toEqual(["019", "020"]);
    });

    it("não estorna nada se nenhum PAR chegou a integrar", () => {
        const r = selecionarParaEstorno([
            res({ sucesso: false, codigoSap: null }),
            res({ sucesso: false, codigoSap: null }),
        ]);
        expect(r).toEqual([]);
    });

    it("ignora sucesso sem codigoSap (defensivo)", () => {
        const r = selecionarParaEstorno([res({ sucesso: true, codigoSap: null })]);
        expect(r).toEqual([]);
    });
});
