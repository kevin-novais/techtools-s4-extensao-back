import { describe, expect, it } from "vitest";

describe("VexpensesApprovedReportsService - grouped expenses (MSW)", () => {
    it("deve retornar groupedExpenses com APIs Vexpenses mockadas", async () => {
        const { VexpensesApprovedReportsService } = await import(
            "../../../src/cron/modules/vexpenses/services/VexpensesApprovedReportsService"
        );

        const service = new VexpensesApprovedReportsService();

        const result = await service.execute({
            buildIntegrations: false,
            sendToSap: false,
            enqueueIntegrations: false,
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty("groupedExpenses");
        expect(result).toHaveProperty("integracoes");
        expect(Array.isArray(result.integracoes)).toBe(true);
        expect(typeof result.groupedExpenses).toBe("object");
    });
});
