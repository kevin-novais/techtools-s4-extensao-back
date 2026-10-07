import { describe, expect, it, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import { ContasContabeisImportService } from "../../../src/modules/contas-contabeis/services/ContasContabeisImportService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        contasContabeis: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("../../../src/config/upload", () => ({
    default: {
        TMP_FOLDER: path.join(process.cwd(), "tmp"),
    },
}));

vi.mock("../../../src/util/date", () => ({
    parseDateAsBrazilian: vi.fn((s: string) => new Date(s)),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

function createValidWorksheet(): XLSX.WorkSheet {
    const ws: XLSX.WorkSheet = {
        "!ref": "A1:J2",
        A1: { v: "chartOfAccounts" },
        B1: { v: "companyCode" },
        C1: { v: "glAccount" },
        D1: { v: "glAccountName" },
        E1: { v: "glAccountECD" },
        F1: { v: "glAccountCosif" },
        G1: { v: "glContaPaiCosif" },
        H1: { v: "itemFluxoDeCaixa" },
        I1: { v: "dataInicio" },
        J1: { v: "dataFim" },
        A2: { v: "PLAN" },
        B2: { v: "1000" },
        C2: { v: "1.1.01.001" },
        D2: { v: "Conta Teste" },
        E2: { v: "" },
        F2: { v: "" },
        G2: { v: "" },
        H2: { v: "001" },
        I2: { v: "2026-01-01" },
        J2: { v: "2026-12-31" },
    };
    return ws;
}

function createInvalidColumnsWorksheet(): XLSX.WorkSheet {
    const ws: XLSX.WorkSheet = {
        "!ref": "A1:B2",
        A1: { v: "colunaErrada" },
        B1: { v: "outraErrada" },
        A2: { v: "x" },
        B2: { v: "y" },
    };
    return ws;
}

const tmpDir = path.join(process.cwd(), "tmp");

describe("ContasContabeisImportService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
    });

    it("deve retornar success com created e skipped corretos quando linhas válidas", async () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = createValidWorksheet();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        const filename = "test-import-valid.xlsx";
        const filePath = path.join(tmpDir, filename);
        XLSX.writeFile(workbook, filePath);

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasContabeis.create).mockResolvedValue({} as any);

        const service = new ContasContabeisImportService();
        const result = await service.execute({ filename });

        expect(result.success).toBe(true);
        expect(result.created).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(s4DotzClient.contasContabeis.create).toHaveBeenCalledOnce();

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it("deve retornar success com skipped quando conta já existe", async () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = createValidWorksheet();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        const filename = "test-import-skip.xlsx";
        const filePath = path.join(tmpDir, filename);
        XLSX.writeFile(workbook, filePath);

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
        } as any);

        const service = new ContasContabeisImportService();
        const result = await service.execute({ filename });

        expect(result.success).toBe(true);
        expect(result.created).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(s4DotzClient.contasContabeis.create).not.toHaveBeenCalled();

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it("deve importar colunas opcionais glAccountB1Xtpg e xtpgAtivado", async () => {
        const ws: XLSX.WorkSheet = {
            "!ref": "A1:L2",
            A1: { v: "chartOfAccounts" },
            B1: { v: "companyCode" },
            C1: { v: "glAccount" },
            D1: { v: "glAccountName" },
            E1: { v: "glAccountECD" },
            F1: { v: "glAccountCosif" },
            G1: { v: "glContaPaiCosif" },
            H1: { v: "itemFluxoDeCaixa" },
            I1: { v: "dataInicio" },
            J1: { v: "dataFim" },
            K1: { v: "glAccountB1Xtpg" },
            L1: { v: "xtpgAtivado" },
            A2: { v: "PLAN" },
            B2: { v: "1000" },
            C2: { v: "1.1.01.099" },
            D2: { v: "Conta XTPG" },
            E2: { v: "" },
            F2: { v: "" },
            G2: { v: "" },
            H2: { v: "001" },
            I2: { v: "2026-01-01" },
            J2: { v: "2026-12-31" },
            K2: { v: "B1999" },
            L2: { v: "true" },
        };

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");
        const filename = "test-import-xtpg.xlsx";
        const filePath = path.join(tmpDir, filename);
        XLSX.writeFile(workbook, filePath);

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasContabeis.create).mockResolvedValue({} as any);

        const service = new ContasContabeisImportService();
        const result = await service.execute({ filename });

        expect(result.success).toBe(true);
        expect(result.created).toBe(1);
        expect(s4DotzClient.contasContabeis.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    GlAccountB1Xtpg: "B1999",
                    XtpgAtivado: true,
                }),
            }),
        );

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it("deve lançar AppError quando colunas obrigatórias faltando", async () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = createInvalidColumnsWorksheet();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        const filename = "test-import-invalid.xlsx";
        const filePath = path.join(tmpDir, filename);
        XLSX.writeFile(workbook, filePath);

        const service = new ContasContabeisImportService();
        const promise = service.execute({ filename });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: expect.stringContaining("Colunas obrigatórias não encontradas"),
            statusCode: 400,
        });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
});
