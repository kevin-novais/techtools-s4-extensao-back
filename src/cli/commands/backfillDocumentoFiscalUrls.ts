import path from "node:path";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { GCSStorage } from "@/providers/gcs-storage";
import log from "@/util/logger";

/**
 * Migra os dados existentes de documento_fiscal_header para o novo formato de
 * colunas de anexo (path relativo + nome tratado), após a migration
 * 20260817120000_reorganizar_urls_anexos_documento_fiscal:
 * - romaneio_url: converte URL pública completa do GCS -> path relativo
 * - romaneio_file_name: preenche a partir do basename do path relativo
 * - pos_relatorio_pdf_file_name / pos_relatorio_xlsx_file_name: preenche a
 *   partir do basename dos paths relativos já existentes (relatorio_pdf/relatorio_xlsx
 *   já eram paths relativos antes da migration)
 */
export async function backfillDocumentoFiscalUrls(apply: boolean): Promise<void> {
    const gcsStorage = new GCSStorage();

    const documentos = await s4DotzClient.documentoFiscalHeader.findMany({
        where: {
            OR: [
                { romaneioUrl: { startsWith: "http" } },
                { AND: [{ posRelatorioPdfUrl: { not: null } }, { posRelatorioPdfFileName: null }] },
                { AND: [{ posRelatorioXlsxUrl: { not: null } }, { posRelatorioXlsxFileName: null }] },
            ],
        },
        select: {
            id: true,
            romaneioUrl: true,
            posRelatorioPdfUrl: true,
            posRelatorioPdfFileName: true,
            posRelatorioXlsxUrl: true,
            posRelatorioXlsxFileName: true,
        },
    });

    log.info(`[backfillDocumentoFiscalUrls] ${documentos.length} documento(s) a processar`);

    for (const documento of documentos) {
        const data: {
            romaneioUrl?: string;
            romaneioFileName?: string;
            posRelatorioPdfFileName?: string;
            posRelatorioXlsxFileName?: string;
        } = {};

        if (documento.romaneioUrl?.startsWith("http")) {
            const blobName = gcsStorage.extractBlobNameFromUrl(documento.romaneioUrl);
            data.romaneioUrl = blobName;
            data.romaneioFileName = path.basename(blobName);
        }

        if (documento.posRelatorioPdfUrl && !documento.posRelatorioPdfFileName) {
            data.posRelatorioPdfFileName = path.basename(documento.posRelatorioPdfUrl);
        }

        if (documento.posRelatorioXlsxUrl && !documento.posRelatorioXlsxFileName) {
            data.posRelatorioXlsxFileName = path.basename(documento.posRelatorioXlsxUrl);
        }

        if (Object.keys(data).length === 0) continue;

        log.info(`[backfillDocumentoFiscalUrls] documento ${documento.id}: ${JSON.stringify(data)}`);

        if (apply) {
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documento.id },
                data,
            });
        }
    }

    log.info(
        apply
            ? "[backfillDocumentoFiscalUrls] Concluído."
            : "[backfillDocumentoFiscalUrls] Dry-run concluído. Use --apply para gravar as alterações."
    );
}
