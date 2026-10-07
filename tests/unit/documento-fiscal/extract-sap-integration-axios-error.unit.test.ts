import { describe, expect, it } from "vitest";
import { extractSapIntegrationAxiosError } from "../../../src/modules/documento-fiscal/utils/integracao/extractSapIntegrationAxiosError";

describe("extractSapIntegrationAxiosError", () => {
    it("prioriza mensagem.erro (objeto) do corpo SAP", () => {
        const result = extractSapIntegrationAxiosError({
            response: {
                status: 400,
                data: { mensagem: { erro: "Conta inválida" } },
            },
            message: "Request failed with status code 400",
        });

        expect(result.mensagem).toBe("Conta inválida");
        expect(result.httpStatus).toBe(400);
        expect(result.corpo).toEqual({ mensagem: { erro: "Conta inválida" } });
    });

    it("não usa só axios.message quando existe response.data", () => {
        const body = { mensagem: "Erro negocial SAP" };
        const result = extractSapIntegrationAxiosError({
            response: { status: 400, data: body },
            message: "Request failed with status code 400",
        });

        expect(result.mensagem).toBe("Erro negocial SAP");
        expect(result.corpo).toEqual(body);
    });

    it("aceita OData error.message.value", () => {
        const result = extractSapIntegrationAxiosError({
            response: {
                status: 400,
                data: {
                    error: {
                        message: { value: "Detalhe OData do SAP" },
                    },
                },
            },
            message: "Request failed with status code 400",
        });

        expect(result.mensagem).toBe("Detalhe OData do SAP");
    });

    it("fallback para message quando não há response", () => {
        const result = extractSapIntegrationAxiosError(new Error("ECONNRESET"));

        expect(result.mensagem).toBe("ECONNRESET");
        expect(result.httpStatus).toBe(500);
        expect(result.corpo).toBeUndefined();
    });
});
