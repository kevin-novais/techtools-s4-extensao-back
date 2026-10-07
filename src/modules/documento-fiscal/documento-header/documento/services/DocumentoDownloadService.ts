import s4DotzClient from "@/database/clients/s4DotzClient";
import { GCSStorage } from "@/providers/gcs-storage";
import AppError from "@/util/AppError";

export const TipoArquivoDownload = {
    ROMANEIO: "romaneio",
    POS_PDF: "pos-pdf",
    POS_XLSX: "pos-xlsx",
} as const;

export type TipoArquivoDownload = typeof TipoArquivoDownload[keyof typeof TipoArquivoDownload];

export class DocumentoDownloadService {
    private readonly gcsStorage = new GCSStorage();

    async execute(
        id: number,
        ciaIds: number[],
        tipo: TipoArquivoDownload = TipoArquivoDownload.ROMANEIO
    ): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
        if (ciaIds.length === 0) throw new AppError("Você não tem acesso a nenhuma CIA", 403);

        const documento = await this.fetchDocumento(id);

        if (!documento) throw new AppError("Documento fiscal não encontrado", 404);
        if (!ciaIds.includes(documento.ciaId)) throw new AppError("Você não tem acesso a esta CIA", 403);

        const { relativePath, filename } = this.resolveArquivo(documento, tipo);

        if (!relativePath || !filename) throw new AppError("Este documento não possui arquivo vinculado", 404);

        const stream = this.gcsStorage.createReadStream(relativePath);

        return { stream, filename };
    }

    private async fetchDocumento(id: number) {
        return s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id },
            select: {
                ciaId: true,
                romaneioUrl: true,
                romaneioFileName: true,
                posRelatorioPdfUrl: true,
                posRelatorioPdfFileName: true,
                posRelatorioXlsxUrl: true,
                posRelatorioXlsxFileName: true,
            },
        });
    }

    private resolveArquivo(
        documento: {
            romaneioUrl: string | null;
            romaneioFileName: string | null;
            posRelatorioPdfUrl: string | null;
            posRelatorioPdfFileName: string | null;
            posRelatorioXlsxUrl: string | null;
            posRelatorioXlsxFileName: string | null;
        },
        tipo: TipoArquivoDownload
    ): { relativePath: string | null; filename: string | null } {
        switch (tipo) {
            case TipoArquivoDownload.POS_PDF:
                return { relativePath: documento.posRelatorioPdfUrl, filename: documento.posRelatorioPdfFileName };
            case TipoArquivoDownload.POS_XLSX:
                return { relativePath: documento.posRelatorioXlsxUrl, filename: documento.posRelatorioXlsxFileName };
            default:
                return { relativePath: documento.romaneioUrl, filename: documento.romaneioFileName };
        }
    }
}
