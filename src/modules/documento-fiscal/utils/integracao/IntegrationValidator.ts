import AppError from "@/util/AppError";
import log from "@/util/logger";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";

interface DocumentoValidado {
    id: number;
    status: string;
}

export class IntegrationValidator {
    async validate(
        documentoFiscalHeaderId: number,
        allowedStatuses: string[] = [StatusDocumento.APROVADO]
    ): Promise<DocumentoValidado | null> {
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                id: true,
                status: true,
            },
        });

        if (!documento) {
            throw new AppError(`Documento fiscal ${documentoFiscalHeaderId} não encontrado`, 404);
        }

        const jaIntegrado = [
            StatusDocumento.INTEGRADO,
            StatusDocumento.RETORNO_INTEG,
            StatusDocumento.ENVIAR_EMAIL,
            StatusDocumento.PROCESSADO,
            StatusDocumento.ERRO_ENVIAR_EMAIL,
        ].includes(documento.status as any);

        if (jaIntegrado) {
            log.warn(`[IntegrationValidator] Documento ${documentoFiscalHeaderId} já integrado (status=${documento.status}). Ignorando.`);
            return null;
        }

        if (!allowedStatuses.includes(documento.status)) {
            throw new AppError(
                `Documento ${documentoFiscalHeaderId} não pode ser integrado. Status atual: ${documento.status}. Esperado: ${allowedStatuses.join(", ")}`,
                400
            );
        }

        return documento;
    }
}
