import { describe, it, expect } from "vitest";
import { buildStatusParaEnvio } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

describe("XTPG status_para_envio textual por fluxo (DTZ-244)", () => {
    it("previsto usa sufixo _PREV", () => {
        expect(buildStatusParaEnvio("PREVISTO", "PROCESSANDO")).toBe("PROCESSANDO_PREV");
        expect(buildStatusParaEnvio("PREVISTO", "SUCESSO")).toBe("SUCESSO_PREV");
        expect(buildStatusParaEnvio("PREVISTO", "ERRO")).toBe("ERRO_PREV");
    });

    it("realizado usa sufixo _FLUX", () => {
        expect(buildStatusParaEnvio("REALIZADO", "PROCESSANDO")).toBe("PROCESSANDO_FLUX");
        expect(buildStatusParaEnvio("REALIZADO", "SUCESSO")).toBe("SUCESSO_FLUX");
        expect(buildStatusParaEnvio("REALIZADO", "ERRO")).toBe("ERRO_FLUX");
    });

    it("cabe no NVARCHAR(20) da coluna status_para_envio", () => {
        const todos = (["PROCESSANDO", "SUCESSO", "ERRO"] as const).flatMap((k) => [
            buildStatusParaEnvio("PREVISTO", k),
            buildStatusParaEnvio("REALIZADO", k),
        ]);
        for (const s of todos) expect(s.length).toBeLessThanOrEqual(20);
    });
});
