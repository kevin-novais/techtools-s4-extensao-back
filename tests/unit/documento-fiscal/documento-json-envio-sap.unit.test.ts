import { describe, expect, it } from "vitest";
import {
    parsePayloadEnvioSap,
    serializeDocumentoJsonEnvioSap,
} from "../../../src/modules/documento-fiscal/utils/documentoJsonEnvioSap";

describe("documentoJsonEnvioSap", () => {
    it("serialize deve produzir um objeto único na raiz com payloads", () => {
        const raw = serializeDocumentoJsonEnvioSap(99, [
            { codigoParceiro: "P1", valorDocumento: 10 },
        ]);
        const parsed = JSON.parse(raw);
        expect(Array.isArray(parsed)).toBe(false);
        expect(parsed.versao).toBe(1);
        expect(parsed.tipo).toBe("createJournalEntry");
        expect(parsed.documentoFiscalHeaderId).toBe(99);
        expect(parsed.payloads).toHaveLength(1);
        expect(parsed.payloads[0].codigoParceiro).toBe("P1");
    });

    it("parse deve normalizar legado com array na raiz", () => {
        const legacy = JSON.stringify([{ x: 1 }, { x: 2 }]);
        const envelope = parsePayloadEnvioSap(legacy, 5);
        expect(envelope).not.toBeNull();
        expect(envelope!.documentoFiscalHeaderId).toBe(5);
        expect(envelope!.payloads).toHaveLength(2);
    });

    it("parse deve ler envelope novo", () => {
        const raw = serializeDocumentoJsonEnvioSap(7, [{ a: 1 }]);
        const envelope = parsePayloadEnvioSap(raw, 999);
        expect(envelope).not.toBeNull();
        expect(envelope!.documentoFiscalHeaderId).toBe(7);
        expect(envelope!.payloads[0]).toMatchObject({ a: 1 });
    });
});
