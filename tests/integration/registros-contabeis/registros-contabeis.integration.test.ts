import { describe, expect, it, vi } from "vitest";

const FIXED_FILTER_DATE = "2026-01-02T00:00:00";

describe("RegistrosContabeis - integration (MSW)", () => {
    it("deve consultar SAP (mockado) e retornar registros contábeis", async () => {
        const { RegistrosContabeisApi } = await import(
            "../../../src/cron/modules/registros-contabeis/http/RegistrosContabeisApi"
        );

        const api = new RegistrosContabeisApi();
        const response = await api.execute({ data: FIXED_FILTER_DATE, skip: 0, top: 100 });

        expect(Array.isArray(response.items)).toBe(true);
        expect(response.items.length).toBeGreaterThan(0);
        expect(response.totalItens).toBeGreaterThan(0);
    });

    it("deve sincronizar registros e retornar métricas", async () => {
        const { SyncRegistrosContabeisService } = await import(
            "../../../src/cron/modules/registros-contabeis/services/SyncRegistrosContabeisService"
        );

        const service = new SyncRegistrosContabeisService();
        vi.spyOn(
            service as unknown as { buildFilterDate: () => string },
            "buildFilterDate",
        ).mockReturnValue(FIXED_FILTER_DATE);

        const metrics = await service.execute();

        expect(metrics).toMatchObject({
            totalReceived: expect.any(Number),
            inserted: expect.any(Number),
            ignored: expect.any(Number),
            invalid: expect.any(Number),
        });
        expect(metrics.totalReceived).toBeGreaterThan(0);
    });
});
