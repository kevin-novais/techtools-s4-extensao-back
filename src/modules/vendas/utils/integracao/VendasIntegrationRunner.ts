import log from "@/util/logger";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { BuildSapIntegrationVendas, IntegracaoSAPJson } from "@/modules/vendas/utils/BuildSapIntegrationVendas";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";

export type VendasIntegrationResultStatus = "sucesso" | "conflito" | "erro";

export interface VendasIntegrationResult {
    codigoParceiro: string;
    status: VendasIntegrationResultStatus;
    statusCode: number;
    numeroDocumentoERP?: string;
    dataVencimento?: Date | null;
    mensagem?: string;
    corpoRespostaSap?: unknown;
}

interface RunnerParams {
    vendasHeaderId: number;
    failFast?: boolean;
}

function parseSapDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const sapDateMatch = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
    const date = sapDateMatch
        ? new Date(Number(sapDateMatch[1]))
        : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

export class VendasIntegrationRunner {
    private readonly integracaoService: IntegracaoSapCreateJournalEntryService;
    private readonly buildService: BuildSapIntegrationVendas;

    constructor() {
        this.integracaoService = new IntegracaoSapCreateJournalEntryService();
        this.buildService = new BuildSapIntegrationVendas();
    }

    async execute(params: RunnerParams): Promise<VendasIntegrationResult[]> {
        const { vendasHeaderId, failFast = true } = params;

        let integracoesJson: IntegracaoSAPJson[];
        try {
            integracoesJson = await this.buildService.execute({ vendasHeaderId });
        } catch (error: any) {
            log.error(
                `[VendasIntegrationRunner] Falha ao montar payload de integração para venda ${vendasHeaderId}: ${error.message}`,
            );
            await this.persistirFalhaBuild(vendasHeaderId, error);
            throw error;
        }

        const resultados: VendasIntegrationResult[] = [];

        for (const integracaoJson of integracoesJson) {
            try {
                log.info(
                    `[VendasIntegrationRunner] Integrando cliente ${integracaoJson.codigoParceiro} da venda ${vendasHeaderId}`,
                );

                const response = await this.integracaoService.execute(integracaoJson);

                this.processarResposta(response, integracaoJson, resultados, failFast);
                await this.persistirRetornoIntegracaoSap(vendasHeaderId, resultados);
            } catch (error: any) {
                const statusCode = error.response?.status || 500;
                const mensagemSap =
                    error.response?.data?.mensagem?.erro ||
                    (typeof error.response?.data?.mensagem === "string"
                        ? error.response?.data?.mensagem
                        : null) ||
                    error.message ||
                    "Erro desconhecido";

                resultados.push({
                    codigoParceiro: integracaoJson.codigoParceiro,
                    status: "erro",
                    statusCode,
                    mensagem: mensagemSap,
                    corpoRespostaSap: error.response?.data ?? null,
                });

                await this.persistirRetornoIntegracaoSap(vendasHeaderId, resultados);

                log.error(
                    `[VendasIntegrationRunner] Erro na integração SAP para cliente ${integracaoJson.codigoParceiro}: status ${statusCode} - ${mensagemSap}`,
                );

                if (failFast) {
                    throw error;
                }
            }
        }

        return resultados;
    }

    private processarResposta(
        response: any,
        integracaoJson: any,
        resultados: VendasIntegrationResult[],
        failFast: boolean,
    ): void {
        if (response.status === 201) {
            resultados.push({
                codigoParceiro: integracaoJson.codigoParceiro,
                status: "sucesso",
                statusCode: 201,
                numeroDocumentoERP: response.data.numeroDocumentoERP,
                dataVencimento: parseSapDate(response.data.dataVencimento),
                mensagem: response.data.mensagem || "Documento criado com sucesso",
                corpoRespostaSap: response.data ?? null,
            });
            return;
        }

        if (response.status === 409) {
            resultados.push({
                codigoParceiro: integracaoJson.codigoParceiro,
                status: "conflito",
                statusCode: 409,
                numeroDocumentoERP: response.data.numeroDocumentoERP,
                mensagem: response.data.mensagem || "Documento já integrado",
                corpoRespostaSap: response.data ?? null,
            });
            return;
        }

        const mensagem = response.data?.mensagem || `Status inesperado: ${response.status}`;
        resultados.push({
            codigoParceiro: integracaoJson.codigoParceiro,
            status: "erro",
            statusCode: response.status,
            mensagem,
            corpoRespostaSap: response.data ?? null,
        });

        if (failFast) {
            throw new Error(mensagem);
        }
    }

    private async persistirRetornoIntegracaoSap(
        vendasHeaderId: number,
        resultados: VendasIntegrationResult[],
    ): Promise<void> {
        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                retornoIntegracaoSap: JSON.stringify({
                    atualizadoEm: new Date().toISOString(),
                    origem: "vendas",
                    resultados: resultados.map((resultado) => ({
                        codigoParceiro: resultado.codigoParceiro,
                        httpStatus: resultado.statusCode,
                        statusIntegracao: resultado.status,
                        mensagem: resultado.mensagem,
                        numeroDocumentoERP: resultado.numeroDocumentoERP,
                        corpo: resultado.corpoRespostaSap,
                    })),
                }),
                atualizadoEm: new Date(),
            },
        });
    }

    /**
     * Persiste request/response quando a montagem do payload falha antes de chegar ao SAP
     * (ex.: cliente/config contábil ausente). Sem isso, o "Atualizar" da tela de detalhes
     * mostrava sempre o request da última tentativa bem-sucedida, dando a impressão de que
     * nada tinha sido reprocessado.
     */
    private async persistirFalhaBuild(vendasHeaderId: number, error: any): Promise<void> {
        const mensagem = error?.message || "Erro desconhecido ao montar payload de integração";
        const agora = new Date();

        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                documentoJson: JSON.stringify(
                    {
                        erro: "Falha ao montar payload de integração SAP",
                        mensagem,
                        atualizadoEm: agora.toISOString(),
                    },
                    null,
                    2,
                ),
                retornoIntegracaoSap: JSON.stringify({
                    atualizadoEm: agora.toISOString(),
                    origem: "vendas",
                    resultados: [
                        {
                            codigoParceiro: "N/A",
                            httpStatus: null,
                            statusIntegracao: "erro",
                            mensagem,
                            numeroDocumentoERP: null,
                            corpo: null,
                        },
                    ],
                }),
                atualizadoEm: agora,
            },
        });
    }
}
