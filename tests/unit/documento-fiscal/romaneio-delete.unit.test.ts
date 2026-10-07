import { describe, expect, it, vi, beforeEach } from "vitest";
import { RomaneioDeleteService } from "../../../src/modules/documento-fiscal/documento-header/romaneio/services/RomaneioDeleteService";
import { StatusDocumento } from "../../../src/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "../../../src/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        documentoFiscalHeader: {
            findUnique: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
    },
}));

const { cleanupFileMock } = vi.hoisted(() => ({
    cleanupFileMock: vi.fn(),
}));

vi.mock("../../../src/util/services/upload.service", () => ({
    UploadDiskStorageService: class {
        extractFilenameFromUrl = vi.fn(() => "x.xlsx");
        cleanupFile = cleanupFileMock;
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("RomaneioDeleteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve permitir exclusão quando status é DIVERGENCIA e tipo TP_ROM", async () => {
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
            id: 1,
            status: StatusDocumento.DIVERGENCIA,
            tipoDocumentoERP: TipoDocumentoERP.TP_ROM,
            romaneioUrl: "troca/romaneio/f.xlsx",
        } as any);

        vi.mocked(s4DotzClient.documentoFiscalHeader.delete).mockResolvedValue({} as any);

        const service = new RomaneioDeleteService();
        const result = await service.execute(1);

        expect(result.message).toContain("sucesso");
        expect(s4DotzClient.documentoFiscalHeader.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("deve permitir exclusão sem arquivo físico quando romaneioUrl é null (POS não passa por esta rota — cobertura defensiva)", async () => {
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
            id: 2,
            status: StatusDocumento.AGUARDANDO,
            tipoDocumentoERP: TipoDocumentoERP.TP_ROM,
            romaneioUrl: null,
        } as any);

        vi.mocked(s4DotzClient.documentoFiscalHeader.delete).mockResolvedValue({} as any);

        const service = new RomaneioDeleteService();
        await service.execute(2);

        expect(s4DotzClient.documentoFiscalHeader.delete).toHaveBeenCalled();
    });

    it("deve rejeitar exclusão quando tipo não é TP_ROM", async () => {
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
            id: 3,
            status: StatusDocumento.AGUARDANDO,
            tipoDocumentoERP: TipoDocumentoERP.TP_POS,
            romaneioUrl: null,
        } as any);

        const service = new RomaneioDeleteService();

        await expect(service.execute(3)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining("TP_ROM"),
        });
    });

    it("deve rejeitar quando status não permitido", async () => {
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
            id: 4,
            status: StatusDocumento.APROVADO,
            tipoDocumentoERP: TipoDocumentoERP.TP_ROM,
            romaneioUrl: "troca/romaneio/f.xlsx",
        } as any);

        const service = new RomaneioDeleteService();

        await expect(service.execute(4)).rejects.toBeInstanceOf(AppError);
    });
});
