import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContasContabeisExportService } from "../../../src/modules/contas-contabeis/services/ContasContabeisExportService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        contasContabeis: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("../../../src/util/date", () => ({
    formatDateOnly: vi.fn((d: Date) => (d ? d.toISOString().split("T")[0] : "")),
    parseDateForFilter: vi.fn((s: string) => new Date(s)),
    parseDateForFilterEnd: vi.fn((s: string) => new Date(s)),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("ContasContabeisExportService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve retornar buffer XLSX com dados formatados", async () => {
        const contas = [
            {
                ChartOfAccounts: "PLAN",
                CompanyCode: "1000",
                GLAccount: "1.1.01.001",
                GLAccountName: "Conta Teste",
                GLAccountECD: "ECD",
                GLAccountCosif: "COSIF",
                GLContaPaiCosif: "PAI",
                ItemFluxoDeCaixa: "001",
                DataInicio: new Date("2026-01-01"),
                DataFim: new Date("2026-12-31"),
            },
        ];

        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValue(contas as any);

        const service = new ContasContabeisExportService();
        const buffer = await service.execute({});

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(0);
        expect(s4DotzClient.contasContabeis.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
                orderBy: [
                    { ChartOfAccounts: "asc" },
                    { CompanyCode: "asc" },
                    { GLAccount: "asc" },
                ],
                take: 10001,
            })
        );
    });

    it("deve aplicar filtros quando fornecidos", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValue([]);

        const service = new ContasContabeisExportService();
        await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1",
            glAccountName: "Conta",
            dataInicio: "2026-01-01",
            dataFim: "2026-12-31",
        });

        expect(s4DotzClient.contasContabeis.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    ChartOfAccounts: { contains: "PLAN" },
                    CompanyCode: { contains: "1000" },
                    GLAccount: { contains: "1.1" },
                    GLAccountName: { contains: "Conta" },
                }),
            })
        );
    });

    it("deve lançar AppError quando resultado excede limite de 10000", async () => {
        const manyContas = Array.from({ length: 10001 }, (_, i) => ({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: `1.1.01.${String(i).padStart(3, "0")}`,
            GLAccountName: `Conta ${i}`,
            GLAccountECD: null,
            GLAccountCosif: null,
            GLContaPaiCosif: null,
            ItemFluxoDeCaixa: "001",
            DataInicio: null,
            DataFim: null,
        }));

        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValue(manyContas as any);

        const service = new ContasContabeisExportService();
        const promise = service.execute({});

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: expect.stringContaining("10000"),
            statusCode: 400,
        });
    });
});
