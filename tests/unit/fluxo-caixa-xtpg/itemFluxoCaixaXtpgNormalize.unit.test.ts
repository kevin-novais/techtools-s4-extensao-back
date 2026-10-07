import { describe, expect, it } from "vitest";
import {
    ITEM_FLUXO_XTPG_RESERVADOS,
    isReservedItemFluxoXtpg,
    isValidClassifiedItemFluxoXtpg,
    normalizeItemFluxoXtpgValue,
    normalizeSapDocReference,
} from "../../../src/cron/modules/fluxo-caixa-xtpg/utils/itemFluxoCaixaXtpgNormalize";

describe("itemFluxoCaixaXtpgNormalize", () => {
    it("normaliza item e trata 999 como reservado", () => {
        expect(normalizeItemFluxoXtpgValue("  abc  ")).toBe("abc");
        expect(isReservedItemFluxoXtpg("999")).toBe(true);
        expect(isReservedItemFluxoXtpg(" 999 ")).toBe(true);
        expect(isValidClassifiedItemFluxoXtpg("001")).toBe(true);
        expect(isValidClassifiedItemFluxoXtpg("")).toBe(false);
    });

    it("trata 0 como reservado", () => {
        expect(isReservedItemFluxoXtpg("0")).toBe(true);
        expect(isReservedItemFluxoXtpg(" 0 ")).toBe(true);
        expect(isValidClassifiedItemFluxoXtpg("0")).toBe(false);
        expect(isReservedItemFluxoXtpg(null)).toBe(true);
        expect(isReservedItemFluxoXtpg(undefined)).toBe(true);
    });

    it("mantem classificados os codigos reais da tabela item_fluxo_caixa", () => {
        for (const codigo of ["2", "7", "8", "20", "44", "76"]) {
            expect(isValidClassifiedItemFluxoXtpg(codigo)).toBe(true);
        }
    });

    it("expoe os reservados como fonte unica p/ o gate e a varredura", () => {
        expect([...ITEM_FLUXO_XTPG_RESERVADOS]).toEqual(["", "0", "999"]);
    });

    it("normaliza referências SAP de documento", () => {
        expect(normalizeSapDocReference("0")).toBeNull();
        expect(normalizeSapDocReference("  ")).toBeNull();
        expect(normalizeSapDocReference("5100000123")).toBe("5100000123");
    });
});
