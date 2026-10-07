import { describe, expect, it, vi } from "vitest";

vi.mock("@/cron/modules/vexpenses/repositories/CiaVexpenseRepository", () => ({
    CiaVexpenseRepository: vi.fn().mockImplementation(() => ({
        resolverCiaId: vi.fn().mockResolvedValue(42),
    })),
}));

vi.mock("@/cron/modules/vexpenses/repositories/ConfiguracaoContabilVexpenseRepository", () => ({
    ConfiguracaoContabilVexpenseRepository: vi.fn().mockImplementation(() => ({
        buscar: vi.fn().mockResolvedValue({
            tipoArApGl: "AP",
            tipoDocumento: "DR",
            textoDocumento: "VExpenses - Texto Config",
        }),
    })),
}));

describe("VexpensesApprovedReportsService - integration json (MSW)", () => {
    it("deve retornar integrações com APIs Vexpenses mockadas", async () => {
        const { VexpensesApprovedReportsService } = await import(
            "../../../src/cron/modules/vexpenses/services/VexpensesApprovedReportsService"
        );

        const service = new VexpensesApprovedReportsService();

        const result = await service.execute({
            buildIntegrations: true,
            sendToSap: false,
            enqueueIntegrations: false,
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty("groupedExpenses");
        expect(result).toHaveProperty("integracoes");
        expect(Array.isArray(result.integracoes)).toBe(true);
    });
});
