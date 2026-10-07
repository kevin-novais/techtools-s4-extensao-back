import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConsultarBoletoBankPlusService } from "../../../src/cron/modules/bankplus-invent/services/ConsultarBoletoBankPlusService";
import AppError from "../../../src/util/AppError";

vi.mock("@/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        cia: {
            findFirst: vi.fn(),
        },
        accountingDocumentItem: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("node:fs", () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

vi.mock("../../../src/config/upload", () => ({
    default: {
        TMP_FOLDER: "/tmp/test-tmp",
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

const PDF_BUFFER = Buffer.from("fake-pdf");

function makeGcsStorage() {
    return {
        saveFile: vi.fn().mockImplementation((file: string, subfolder: string) => Promise.resolve(`${subfolder}/${file}`)),
        getPublicUrl: vi.fn().mockImplementation((blobName: string) => `https://storage.googleapis.com/test-bucket/${blobName}`),
    } as any;
}

function makeVenda(overrides: Partial<{
    id: number;
    ciaIdSAP: number;
    ano: number | null;
    codigoDocumentoERP: string | null;
}> = {}) {
    return {
        id: 10,
        ciaIdSAP: 1410,
        ano: 2026,
        codigoDocumentoERP: "1900002341",
        ...overrides,
    };
}

function makeCia(overrides: Partial<{ id: number; ciaIdSAP: string }> = {}) {
    return {
        id: 1,
        ciaIdSAP: "1410",
        ...overrides,
    };
}

function makeRegistroContabil(overrides: Partial<{
    ReferenceDocumentType: string | null;
    Customer: string | null;
}> = {}) {
    return {
        ReferenceDocumentType: "VBRK",
        Customer: "BP123",
        ...overrides,
    };
}

describe("ConsultarBoletoBankPlusService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({} as any);
    });

    it("lança AppError 400 quando vendasHeaderId é inválido", async () => {
        const api = { getBoletoPdf: vi.fn() } as any;
        const service = new ConsultarBoletoBankPlusService(api);

        await expect(service.execute({ vendasHeaderId: 0 })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.execute({ vendasHeaderId: -5 })).rejects.toMatchObject({ statusCode: 400 });
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 404 quando venda não existe", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(null);
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 99 }))
            .rejects.toMatchObject({ message: "Venda não encontrada", statusCode: 404 });
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando CIA não é encontrada", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(null);
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando codigoDocumentoERP está ausente", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ codigoDocumentoERP: null }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toBeInstanceOf(AppError);
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
        expect(s4DotzClient.accountingDocumentItem.findFirst).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando ano fiscal está ausente", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ ano: null }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toBeInstanceOf(AppError);
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando não encontra o registro contábil correspondente", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(null);
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando registro contábil não tem reference_document_type", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(
            makeRegistroContabil({ ReferenceDocumentType: null }) as any,
        );
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toBeInstanceOf(AppError);
        expect(api.getBoletoPdf).not.toHaveBeenCalled();
    });

    it("lança AppError 400 quando registro contábil não tem customer", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(
            makeRegistroContabil({ Customer: null }) as any,
        );
        const api = { getBoletoPdf: vi.fn() } as any;

        await expect(new ConsultarBoletoBankPlusService(api).execute({ vendasHeaderId: 10 }))
            .rejects.toBeInstanceOf(AppError);
    });

    it("busca o registro contábil por CompanyCode, FiscalYear e AccountingDocument, exigindo Customer preenchido", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(makeRegistroContabil() as any);
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);

        await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, makeGcsStorage()).execute({ vendasHeaderId: 10 });

        expect(s4DotzClient.accountingDocumentItem.findFirst).toHaveBeenCalledWith({
            where: {
                CompanyCode: "1410",
                FiscalYear: "2026",
                AccountingDocument: "1900002341",
                Customer: { not: null },
            },
            select: { ReferenceDocumentType: true, Customer: true },
        });
    });

    it("monta documentoId com prefixo S4P e separador # na ordem correta (usando reference_document_type e customer do registro contábil)", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(makeRegistroContabil() as any);
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);

        const result = await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, makeGcsStorage())
            .execute({ vendasHeaderId: 10 });

        expect(getBoletoPdf).toHaveBeenCalledWith("S4P#1410#2026#1900002341#VBRK#BP123");
        expect(result.vendasHeaderId).toBe(10);
        expect(result.documentoId).toBe("S4P#1410#2026#1900002341#VBRK#BP123");
        expect(result.pathBoleto).toMatch(/boleto-10-2026-\d+-[a-f0-9]{16}\.pdf$/);
    });

    it("usa ciaIdSAP como string da tabela Cia (preserva zeros à esquerda)", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ ciaIdSAP: 101 }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia({ ciaIdSAP: "0101" }) as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(makeRegistroContabil() as any);
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);

        const result = await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, makeGcsStorage())
            .execute({ vendasHeaderId: 10 });

        expect(s4DotzClient.accountingDocumentItem.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ CompanyCode: "0101" }) }),
        );
        expect(getBoletoPdf).toHaveBeenCalledWith("S4P#0101#2026#1900002341#VBRK#BP123");
        expect(result.documentoId).toContain("#0101#");
    });

    it("sobe o PDF pro bucket GCS e grava pathBoleto (URL pública) e codigoBoleto no banco", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(makeRegistroContabil() as any);
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);
        const gcsStorage = makeGcsStorage();

        await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, gcsStorage).execute({ vendasHeaderId: 10 });

        expect(gcsStorage.saveFile).toHaveBeenCalledWith(
            expect.stringMatching(/^boleto-10-2026-\d+-[a-f0-9]{16}\.pdf$/),
            "boletos",
        );
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 10 },
                data: expect.objectContaining({
                    codigoBoleto: "S4P#1410#2026#1900002341#VBRK#BP123",
                    pathBoleto: expect.stringMatching(
                        /^https:\/\/storage\.googleapis\.com\/test-bucket\/boletos\/boleto-10-2026-\d+-[a-f0-9]{16}\.pdf$/,
                    ),
                    status: "ENVIANDO_EMAIL",
                    erroConsultaBoleto: null,
                    retornoConsultaBoletoInvent: "Boleto obtido com sucesso",
                    dataUltimaConsultaBoleto: expect.any(Date),
                }),
            }),
        );
    });

    it("faz trim dos campos string vindos do registro contábil antes de montar documentoId", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(
            makeVenda({ codigoDocumentoERP: "  1900002341  " }) as any,
        );
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(
            makeRegistroContabil({ ReferenceDocumentType: " VBRK ", Customer: "  BP123  " }) as any,
        );
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);

        await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, makeGcsStorage()).execute({ vendasHeaderId: 10 });

        expect(getBoletoPdf).toHaveBeenCalledWith("S4P#1410#2026#1900002341#VBRK#BP123");
    });

    it("seleciona apenas os campos necessários da VendasHeader", async () => {
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue(makeVenda() as any);
        vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(makeCia() as any);
        vi.mocked(s4DotzClient.accountingDocumentItem.findFirst).mockResolvedValue(makeRegistroContabil() as any);
        const getBoletoPdf = vi.fn().mockResolvedValue(PDF_BUFFER);

        await new ConsultarBoletoBankPlusService({ getBoletoPdf } as any, makeGcsStorage()).execute({ vendasHeaderId: 10 });

        expect(s4DotzClient.vendasHeader.findUnique).toHaveBeenCalledWith({
            where: { id: 10 },
            select: {
                id: true,
                ciaIdSAP: true,
                ano: true,
                codigoDocumentoERP: true,
            },
        });
    });
});
