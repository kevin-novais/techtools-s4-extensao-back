import { describe, expect, it } from "vitest";
import { mapearTipoDocumentoErpParaIntegracaoSap } from "../../../src/modules/documento-fiscal/utils/mapearTipoDocumentoErpParaIntegracaoSap";

describe("mapearTipoDocumentoErpParaIntegracaoSap", () => {
    it("deve mapear TP_ROM para KR", () => {
        expect(mapearTipoDocumentoErpParaIntegracaoSap("TP_ROM")).toBe("KR");
    });

    it("deve mapear TP_POS para KR", () => {
        expect(mapearTipoDocumentoErpParaIntegracaoSap("TP_POS")).toBe("KR");
    });

    it("deve retornar o tipo inalterado para DR", () => {
        expect(mapearTipoDocumentoErpParaIntegracaoSap("DR")).toBe("DR");
    });

    it("deve retornar o valor inalterado para tipos desconhecidos", () => {
        expect(mapearTipoDocumentoErpParaIntegracaoSap("XX")).toBe("XX");
    });
});
