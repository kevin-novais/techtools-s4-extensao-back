import path from "node:path";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import { UploadDiskStorageService } from "@/util/services/upload.service";
import { Config } from "@/config/config";
import log from "@/util/logger";

const statusPermitidosParaDelecao: readonly string[] = [
    StatusDocumento.AGUARDANDO,
    StatusDocumento.REPROVADO,
    StatusDocumento.ERRO_PROCESSAMENTO,
    StatusDocumento.ERRO_INTEG,
    StatusDocumento.ERRO_RETORNO_INTEG,
    StatusDocumento.ERRO_ENVIAR_EMAIL,
    StatusDocumento.DIVERGENCIA,
];

export class RomaneioDeleteService {

    async execute(documentoFiscalId: number) {
        const documentoFiscal = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalId },
        });

        if (!documentoFiscal) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!statusPermitidosParaDelecao.includes(documentoFiscal.status)) {
            throw new AppError(
                `Documento fiscal não pode ser deletado. Status atual: ${documentoFiscal.status}. Apenas documentos com status ${statusPermitidosParaDelecao.join(", ")} podem ser deletados.`,
                400
            );
        }

        if (documentoFiscal.tipoDocumentoERP !== TipoDocumentoERP.TP_ROM) {
            throw new AppError(
                "Somente documentos do tipo romaneio (TP_ROM) podem ser excluídos por esta rota.",
                400
            );
        }

        const uploadService = new UploadDiskStorageService();
        if (documentoFiscal.romaneioUrl) {
            // Um mesmo arquivo pode ter gerado vários documentos (um por código):
            // só remove a planilha quando nenhum outro header ainda a utiliza
            const outrosDocumentos = await s4DotzClient.documentoFiscalHeader.count({
                where: {
                    romaneioUrl: documentoFiscal.romaneioUrl,
                    id: { not: documentoFiscalId },
                },
            });

            if (outrosDocumentos > 0) {
                log.info(
                    `[RomaneioDeleteService] Planilha mantida: ainda usada por ${outrosDocumentos} documento(s) do mesmo romaneio`
                );
            } else {
                try {
                    await uploadService.cleanupFile(path.basename(documentoFiscal.romaneioUrl), Config.GCS_ROMANEIO_SUBFOLDER);
                } catch (error) {
                    log.error("Erro ao deletar arquivo físico: %o", error);
                }
            }
        }

        await s4DotzClient.documentoFiscalHeader.delete({
            where: { id: documentoFiscalId },
        });

        return {
            message: "Documento fiscal deletado com sucesso",
        };
    }
}

