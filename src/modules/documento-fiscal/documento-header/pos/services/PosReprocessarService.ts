import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import { publishProcessarDetalhesPOS } from "@/queue/producers/documentoFiscalProducer";
import log from "@/util/logger";
import { formatDocumentoFiscalHeader } from "@/modules/documento-fiscal/utils/formatDocumentoFiscalHeader";

interface PosReprocessarParams {
    documentoId: number;
    usuarioId: number;
}

const STATUS_PERMITIDOS = new Set<string>([
    StatusDocumento.DIVERGENCIA,
    StatusDocumento.ERRO_PROCESSAMENTO,
    StatusDocumento.ERRO_INTEG,
    "ERRO_INTEGRACAO",
    StatusDocumento.ERRO_RETORNO_INTEG,
    StatusDocumento.ERRO_ENVIAR_EMAIL,
]);

export class PosReprocessarService {
    async execute(params: PosReprocessarParams) {
        const { documentoId, usuarioId } = params;

        log.info(`[PosReprocessarService] Iniciando reprocessamento do documento POS ${documentoId}`);

        const documento = await this.validateDocumento(documentoId);
        await this.validateUsuarioAcesso(usuarioId, documento.ciaId, documento.cia.nome);

        const filtros = this.parseFiltros(documento.filtrosPosJson, documentoId);

        await this.deleteDetalhesAntigos(documentoId);
        const documentoAtualizado = await this.resetDocumentoParaReprocessamento(documentoId, usuarioId);

        await publishProcessarDetalhesPOS({
            documentoFiscalHeaderId: documentoId,
            filtros,
        });

        log.info(`[PosReprocessarService] Reprocessamento iniciado para documento POS ${documentoId}`);

        return formatDocumentoFiscalHeader(documentoAtualizado);
    }

    private async validateDocumento(documentoId: number) {
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoId },
            include: {
                cia: { select: { id: true, nome: true } },
            },
        });

        if (!documento) throw new AppError("Documento não encontrado", 404);

        if (documento.tipoDocumentoERP !== TipoDocumentoERP.TP_POS) {
            throw new AppError("Somente documentos do tipo POS (TP_POS) podem ser reprocessados por esta rota", 400);
        }

        if (!STATUS_PERMITIDOS.has(documento.status)) {
            throw new AppError(
                `Documento não pode ser reprocessado neste status. Status atual: ${documento.status}`,
                400
            );
        }

        return documento;
    }

    private async validateUsuarioAcesso(usuarioId: number, ciaId: number, ciaNome: string) {
        const grupos = await s4DotzClient.usuarioGrupoUsuario.findMany({
            where: {
                usuarioId,
                grupoUsuario: { ciaId, deletadoEm: null },
            },
        });

        if (grupos.length === 0) {
            throw new AppError(`Usuário não possui acesso à CIA ${ciaNome}`, 403);
        }
    }

    private parseFiltros(filtrosPosJson: string | null, documentoId: number) {
        if (!filtrosPosJson) {
            throw new AppError(
                "Documento não possui filtros armazenados para reprocessamento. Crie um novo documento POS.",
                400
            );
        }

        try {
            return JSON.parse(filtrosPosJson) as Record<string, string>;
        } catch {
            log.error(`[PosReprocessarService] filtrosPosJson inválido no documento ${documentoId}: ${filtrosPosJson}`);
            throw new AppError("Filtros de reprocessamento corrompidos. Crie um novo documento POS.", 500);
        }
    }

    private async deleteDetalhesAntigos(documentoId: number) {
        const result = await s4DotzClient.documentoFiscalDetalhe.deleteMany({
            where: { documentoFiscalHeaderId: documentoId },
        });

        log.info(`[PosReprocessarService] ${result.count} detalhes removidos do documento ${documentoId}`);
    }

    private async resetDocumentoParaReprocessamento(documentoId: number, usuarioId: number) {
        return s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoId },
            data: {
                status: StatusDocumento.AGUARDANDO,
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
                valorTotalProdutos: null,
                valorTotalPedido: null,
                valorTotalFrete: null,
                valorTotalCombo: null,
                valorTotalIs: null,
                valorTotalCbs: null,
                valorTotalIbsUf: null,
                valorTotalIbsMunicipal: null,
                dataProcessamentoInicio: null,
                dataProcessamentoFim: null,
            },
            include: {
                cia: { select: { id: true, nome: true } },
                criadoPorUsuario: { select: { id: true, nome: true, email: true } },
                atualizadoPorUsuario: { select: { id: true, nome: true, email: true } },
            },
        });
    }
}
