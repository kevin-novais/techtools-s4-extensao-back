import log from "@/util/logger";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { BuildSapIntegration, IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";
import { PostIntegrationUpdaterService } from "@/modules/documento-fiscal/utils/integracao/post-integration/PostIntegrationUpdaterService";
import { EnviarRelatorioFornecedorEmailService } from "@/modules/documento-fiscal/utils/integracao/EnviarRelatorioFornecedorEmailService";
import {
    buildRetornoIntegracaoSapPayload,
    serializeRetornoIntegracaoSap,
} from "@/modules/documento-fiscal/utils/integracao/retornoIntegracaoSapJson";
import { serializeDocumentoJsonEnvioSap } from "@/modules/documento-fiscal/utils/documentoJsonEnvioSap";
import { extractSapIntegrationAxiosError } from "@/modules/documento-fiscal/utils/integracao/extractSapIntegrationAxiosError";

export type IntegrationResultStatus = "sucesso" | "conflito" | "erro";

export interface IntegrationResult {
    codigoParceiro: string;
    status: IntegrationResultStatus;
    statusCode: number;
    numeroDocumentoERP?: string;
    mensagem?: string;
    /** Corpo da resposta SAP (axios response.data) ou payload de erro quando existir */
    corpoRespostaSap?: unknown;
}

interface RunnerParams {
    documentoFiscalHeaderId: number;
    usuarioId: number;
    failFast?: boolean;
}

export class IntegrationRunner {
    private readonly integracaoService: IntegracaoSapCreateJournalEntryService;
    private readonly buildService: BuildSapIntegration;
    private readonly postIntegrationUpdater: PostIntegrationUpdaterService;
    private readonly relatorioEmailService: EnviarRelatorioFornecedorEmailService;

    constructor() {
        this.integracaoService = new IntegracaoSapCreateJournalEntryService();
        this.buildService = new BuildSapIntegration();
        this.postIntegrationUpdater = new PostIntegrationUpdaterService();
        this.relatorioEmailService = new EnviarRelatorioFornecedorEmailService();
    }

    async execute(params: RunnerParams): Promise<IntegrationResult[]> {
        const { documentoFiscalHeaderId, usuarioId, failFast = true } = params;

        const header = await s4DotzClient.documentoFiscalHeader.findUniqueOrThrow({
            where: { id: documentoFiscalHeaderId },
            select: { tipoDocumentoERP: true },
        });

        const isRomaneio = header.tipoDocumentoERP === "TP_ROM";

        let integracoesJson: IntegracaoSAPJson[];
        try {
            integracoesJson = await this.buildService.execute({
                documentoFiscalHeaderId,
                usuarioId,
            });
        } catch (error: any) {
            log.error(
                `[IntegrationRunner] Falha ao montar payload de integração para documento ${documentoFiscalHeaderId}: ${error.message}`,
            );
            await this.persistirFalhaBuild(documentoFiscalHeaderId, usuarioId, error);
            throw error;
        }

        const resultados: IntegrationResult[] = [];

        for (const integracaoJson of integracoesJson) {
            log.info(`[IntegrationRunner] Integrando parceiro ${integracaoJson.codigoParceiro} do documento ${documentoFiscalHeaderId}`);

            let response: any;
            try {
                response = await this.integracaoService.execute(integracaoJson);
            } catch (error: unknown) {
                const extracted = extractSapIntegrationAxiosError(error);

                resultados.push({
                    codigoParceiro: integracaoJson.codigoParceiro ?? "",
                    status: "erro",
                    statusCode: extracted.httpStatus,
                    mensagem: extracted.mensagem,
                    corpoRespostaSap: extracted.corpo,
                });

                log.error(`[IntegrationRunner] Erro na integração SAP para parceiro ${integracaoJson.codigoParceiro}: status ${extracted.httpStatus} - ${extracted.mensagem}`);

                await this.persistRetornoIntegracaoSap(documentoFiscalHeaderId, resultados);

                if (failFast) throw error;
                continue;
            }

            await this.processarResposta({
                response,
                integracaoJson,
                documentoFiscalHeaderId,
                usuarioId,
                resultados,
                failFast,
                enviarEmail: !isRomaneio,
            });
        }

        await this.persistRetornoIntegracaoSap(documentoFiscalHeaderId, resultados);

        return resultados;
    }

    private obterRelatorioAnexos(integracaoJson: any): { pdfUrl: string; xlsxUrl: string } | null {
        const relatorioPdf = integracaoJson.anexos?.find((anexo: any) => anexo.nomeAnexo === "RELATORIO");
        const relatorioXlsx = integracaoJson.anexos?.find((anexo: any) => anexo.nomeAnexo === "RELATORIO_XLSX");

        if (!relatorioPdf?.localAnexo || !relatorioXlsx?.localAnexo) {
            return null;
        }

        return {
            pdfUrl: relatorioPdf.localAnexo,
            xlsxUrl: relatorioXlsx.localAnexo,
        };
    }

    private async processarResposta(params: {
        response: any;
        integracaoJson: any;
        documentoFiscalHeaderId: number;
        usuarioId: number;
        resultados: IntegrationResult[];
        failFast: boolean;
        enviarEmail: boolean;
    }) {
        const { response, integracaoJson, documentoFiscalHeaderId, usuarioId, resultados, failFast, enviarEmail } = params;
        const corpo = response.data;

        if (response.status === 201) {
            resultados.push({
                codigoParceiro: integracaoJson.codigoParceiro,
                status: "sucesso",
                statusCode: 201,
                numeroDocumentoERP: response.data.numeroDocumentoERP,
                mensagem: response.data.mensagem || "Documento criado com sucesso",
                corpoRespostaSap: corpo,
            });

            await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.INTEGRADO, usuarioId, new Date());

            try {
                await this.postIntegrationUpdater.execute({
                    documentoFiscalHeaderId,
                    codigoFornecedorSAP: integracaoJson.codigoParceiro,
                    numeroDocumentoERP: response.data.numeroDocumentoERP,
                });
            } catch (postError) {
                log.error(
                    `[IntegrationRunner] Falha na atualização pós-integração (documento=${documentoFiscalHeaderId}, fornecedor=${integracaoJson.codigoParceiro}): %o`,
                    postError
                );
                await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.ERRO_RETORNO_INTEG, usuarioId);
                return;
            }

            await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.RETORNO_INTEG, usuarioId);

            const relatorioAnexos = this.obterRelatorioAnexos(integracaoJson);
            if (relatorioAnexos && enviarEmail) {
                await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.ENVIAR_EMAIL, usuarioId);
                try {
                    await this.relatorioEmailService.execute({
                        documentoFiscalHeaderId,
                        codigoFornecedorSAP: integracaoJson.codigoParceiro,
                    });
                    await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.PROCESSADO, usuarioId);
                } catch (emailError) {
                    await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.ERRO_ENVIAR_EMAIL, usuarioId);
                    log.error(
                        `[IntegrationRunner] Falha ao enviar e-mail de relatorio para fornecedor ${integracaoJson.codigoParceiro} (documento=${documentoFiscalHeaderId}): %o`,
                        emailError
                    );
                }
                return;
            }

            await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.PROCESSADO, usuarioId);
            log.warn(
                `[IntegrationRunner] Relatorio nao encontrado nos anexos para fornecedor ${integracaoJson.codigoParceiro}`
            );
            return;
        }

        if (response.status === 409) {
            resultados.push({
                codigoParceiro: integracaoJson.codigoParceiro,
                status: "conflito",
                statusCode: 409,
                numeroDocumentoERP: response.data.numeroDocumentoERP,
                mensagem: response.data.mensagem || "Documento já integrado",
                corpoRespostaSap: corpo,
            });
            await this.updateDocumentoStatus(documentoFiscalHeaderId, StatusDocumento.PROCESSADO, usuarioId);
            return;
        }

        const mensagem = response.data?.mensagem || `Status inesperado: ${response.status}`;
        resultados.push({
            codigoParceiro: integracaoJson.codigoParceiro,
            status: "erro",
            statusCode: response.status,
            mensagem,
            corpoRespostaSap: corpo,
        });

        await this.persistRetornoIntegracaoSap(documentoFiscalHeaderId, resultados);

        if (failFast) {
            throw new Error(mensagem);
        }
    }

    private async updateDocumentoStatus(
        documentoFiscalHeaderId: number,
        status: string,
        usuarioId: number,
        dataIntegracao?: Date,
    ): Promise<void> {
        try {
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoFiscalHeaderId },
                data: {
                    status,
                    ...(dataIntegracao ? { dataIntegracao } : {}),
                    atualizadoPor: usuarioId,
                    atualizadoEm: new Date(),
                },
            });
            log.info(`[IntegrationRunner] Status atualizado para ${status} (documento=${documentoFiscalHeaderId})`);
        } catch (error) {
            log.error(`[IntegrationRunner] Falha ao atualizar status para ${status} (documento=${documentoFiscalHeaderId}): %o`, error);
        }
    }

    private async persistRetornoIntegracaoSap(documentoFiscalHeaderId: number, resultados: IntegrationResult[]) {
        try {
            const payload = buildRetornoIntegracaoSapPayload("integration_runner", resultados);
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoFiscalHeaderId },
                data: { retornoIntegracaoSap: serializeRetornoIntegracaoSap(payload) },
            });
        } catch (persistError) {
            log.error(
                `[IntegrationRunner] Falha ao persistir retornoIntegracaoSap para documento ${documentoFiscalHeaderId}:`,
                persistError
            );
        }
    }

    /**
     * Persiste request/response quando a montagem do payload falha antes de chegar ao SAP
     * (ex.: CIA sem ciaIdSAP, config contábil ausente, detalhe sem fornecedor). Sem isso, o
     * "Atualizar" da tela de detalhes mostrava sempre o request da última tentativa
     * bem-sucedida, dando a impressão de que nada tinha sido reprocessado.
     */
    private async persistirFalhaBuild(
        documentoFiscalHeaderId: number,
        usuarioId: number,
        error: any,
    ): Promise<void> {
        const mensagem = error?.message || "Erro desconhecido ao montar payload de integração";

        try {
            const documentoJson = serializeDocumentoJsonEnvioSap(documentoFiscalHeaderId, [
                {
                    erro: "Falha ao montar payload de integração SAP",
                    mensagem,
                },
            ]);

            const retornoIntegracaoSap = serializeRetornoIntegracaoSap(
                buildRetornoIntegracaoSapPayload("build_failure", [
                    {
                        codigoParceiro: "N/A",
                        status: "erro",
                        statusCode: 0,
                        mensagem,
                    },
                ]),
            );

            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoFiscalHeaderId },
                data: {
                    documentoJson,
                    retornoIntegracaoSap,
                    atualizadoPor: usuarioId,
                    atualizadoEm: new Date(),
                },
            });
        } catch (persistError) {
            log.error(
                `[IntegrationRunner] Falha ao persistir request/response de falha de montagem para documento ${documentoFiscalHeaderId}:`,
                persistError
            );
        }
    }
}
