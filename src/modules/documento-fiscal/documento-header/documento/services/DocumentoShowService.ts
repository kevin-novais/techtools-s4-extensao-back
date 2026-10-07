import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import AppError from "@/util/AppError";
import { formatDocumentoFiscalHeader } from "@/modules/documento-fiscal/utils/formatDocumentoFiscalHeader";

export class DocumentoShowService {
    async execute(id: number, ciaIds: number[]) {
        if (ciaIds.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id },
            include: {
                cia: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                criadoPorUsuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
                atualizadoPorUsuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            },
        });

        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciaIds.includes(documento.ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        let cardName: string | null = null;

        if (documento.codigoFornecedorSAP) {
            const fornecedor = await dotzStageClient().oCRD.findUnique({
                where: {
                    CardCode: documento.codigoFornecedorSAP,
                },
                select: {
                    CardName: true,
                },
            });

            cardName = fornecedor?.CardName ?? null;
        }

        const quantidadeTotalDivergencias = await s4DotzClient.documentoFiscalErrors.count({
            where: {
                documentoFiscalDetalhe: {
                    documentoFiscalHeaderId: id,
                },
            },
        });

        return formatDocumentoFiscalHeader(documento, cardName, quantidadeTotalDivergencias);
    }
}

