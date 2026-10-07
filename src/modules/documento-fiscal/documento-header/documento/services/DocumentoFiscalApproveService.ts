import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoErro } from "@/@types/DocumentoFiscalError/TipoErroTypes";
import { normalizeDateToMidnightUTC } from "@/util/date";
import { IntegrationOrchestratorService } from "@/modules/documento-fiscal/utils/integracao/IntegrationOrchestratorService";
import {
    buildRetornoIntegracaoSapPayload,
    serializeRetornoIntegracaoSap,
} from "@/modules/documento-fiscal/utils/integracao/retornoIntegracaoSapJson";
import log from "@/util/logger";

interface DocumentoFiscalApproveParams {
    documentoId: number;
    usuarioId: number;
    ciaIds: number[];
    observacao: string;
}

interface IntegracaoResultado {
    codigoParceiro: string;
    status: "sucesso" | "conflito" | "erro";
    statusCode: number;
    numeroDocumentoERP?: string;
    mensagem?: string;
}

interface DocumentoFiscalApproveResponse {
    integracoes: IntegracaoResultado[];
    statusGeral: number;
}

export class DocumentoFiscalApproveService {
    private readonly orchestrator: IntegrationOrchestratorService;

    constructor() {
        this.orchestrator = new IntegrationOrchestratorService();
    }

    async execute(params: DocumentoFiscalApproveParams): Promise<DocumentoFiscalApproveResponse> {
        const { documentoId, usuarioId, ciaIds, observacao } = params;

        if (ciaIds.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoId },
            include: {
                cia: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });

        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciaIds.includes(documento.ciaId)) {
            throw new AppError(`Você não tem acesso a esta CIA ${documento.ciaId}`, 403);
        }

        if (documento.status !== StatusDocumento.DIVERGENCIA) {
            throw new AppError(`Documento não pode ser aprovado neste status. Status atual: ${documento.status}`,400);
        }

        await this.validarErrosCriticos(documentoId);

        await this.validarPermissaoAprovar(usuarioId, documento.ciaId, documento.cia.nome);

        let resultados;
        try {
            ({ resultados } = await this.orchestrator.integrate({
                documentoFiscalHeaderId: documentoId,
                usuarioId,
                origem: "MANUAL",
                failFast: false,
                updateStatus: false,
                allowedStatuses: [StatusDocumento.DIVERGENCIA, StatusDocumento.APROVADO],
            }));
        } catch (error) {
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoId },
                data: {
                    status: StatusDocumento.ERRO_INTEG,
                    atualizadoPor: usuarioId,
                    atualizadoEm: new Date(),
                },
            });
            throw error;
        }

        const todasSucesso = resultados.every((r) => r.status === "sucesso");

        if (!todasSucesso) {
            const falhas = resultados.filter((r) => r.status !== "sucesso");

            log.error(
                `[RomaneioApproveService] Documento ${documentoId} não aprovado. Falhas na integração SAP: ${JSON.stringify(falhas, null, 2)}`
            );

            // Persiste todos os resultados (sucesso + falha), não só as falhas — em documentos
            // com múltiplos fornecedores, sobrescrever com apenas as falhas apagava do Response
            // o retorno SAP dos fornecedores que tinham sido integrados com sucesso na mesma tentativa.
            const retornoJson = serializeRetornoIntegracaoSap(
                buildRetornoIntegracaoSapPayload("approve_failure", resultados)
            );

            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoId },
                data: {
                    status: StatusDocumento.ERRO_INTEG,
                    retornoIntegracaoSap: retornoJson,
                    atualizadoPor: usuarioId,
                    atualizadoEm: new Date(),
                },
            });

            throw new AppError(
                `Não foi possível aprovar o documento devido a falhas na integração SAP`,
                400
            );
        }

        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoId },
            data: {
                observacoesRomaneio: observacao,
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
            },
        });

        const statusGeral = this.determinarStatusGeral(resultados);

        return {
            integracoes: resultados,
            statusGeral,
        };
    }

    private determinarStatusGeral(resultados: IntegracaoResultado[]): number {
        const temSucesso = resultados.some((r) => r.status === "sucesso");
        const temErro = resultados.some((r) => r.status === "erro");
        const todosSaoConflitos = resultados.every((r) => r.status === "conflito");

        if (temErro) {
            return 500;
        }

        if (todosSaoConflitos) {
            return 409;
        }

        if (temSucesso) {
            return 201;
        }

        return 500;
    }

    private async validarErrosCriticos(documentoFiscalHeaderId: number) {
        const temErrosCriticos = await s4DotzClient.documentoFiscalErrors.findFirst({
            where: {
                documentoFiscalDetalhe: {
                    documentoFiscalHeaderId,
                },
                tipo: TipoErro.ERRO,
            },
            select: {
                id: true,
            },
        });

        if (temErrosCriticos) {
            throw new AppError(
                "Não é possível aprovar documentos com erros críticos. Corrija os erros antes de aprovar.",
                400
            );
        }
    }

    private async validarPermissaoAprovar(usuarioId: number, ciaId: number, ciaNome: string) {
        const gruposUsuario = await s4DotzClient.usuarioGrupoUsuario.findMany({
            where: {
                usuarioId,
                grupoUsuario: {
                    ciaId,
                    deletadoEm: null,
                    aprovaDivergencia: true,
                },
            },
            include: {
                grupoUsuario: {
                    select: {
                        id: true,
                        dataInicio: true,
                        dataFim: true,
                        aprovaDivergencia: true,
                    },
                },
            },
        });

        if (gruposUsuario.length === 0) {
            throw new AppError(
                `Você não possui permissão para aprovar divergências na CIA ${ciaNome}`,
                403
            );
        }

        const dataAtual = normalizeDateToMidnightUTC(new Date());
        type GrupoUsuarioRel = (typeof gruposUsuario)[number];

        const temGrupoValido = gruposUsuario.some((rel: GrupoUsuarioRel) => {
            const grupo = rel.grupoUsuario;
            const dataInicio = normalizeDateToMidnightUTC(grupo.dataInicio);
            const dataFim = normalizeDateToMidnightUTC(grupo.dataFim);

            return dataAtual >= dataInicio && dataAtual <= dataFim;
        });

        if (!temGrupoValido) {
            throw new AppError(
                `Nenhum dos seus grupos com permissão de aprovar divergências está ativo no período atual para a CIA ${ciaNome}`,
                403
            );
        }
    }
}
