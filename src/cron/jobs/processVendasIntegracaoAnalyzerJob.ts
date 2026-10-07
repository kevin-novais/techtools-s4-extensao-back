import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import apm from "@/apm";
import { Config } from "@/config/config";
import { CronJobDefinition } from "@/cron/CronManager";
import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { GCSStorage } from "@/providers/gcs-storage";
import log from "@/util/logger";
import type { Faturamento, FaturamentoDetalhe, Prisma } from "@prisma/client-dotz-stage";

const STATUS_ANALYZER_PENDENTE = "1";
const STATUS_ANALYZER_INTEGRADO = "2";
const TIPO_CADASTRO_ANALYZER = "ANALYZER";
const gcsStorage = new GCSStorage();

function buildStorageUrl(caminho: string | null): string | null {
    const caminhoNormalizado = caminho?.trim();

    if (!caminhoNormalizado) return null;
    if (/^https?:\/\//i.test(caminhoNormalizado)) return caminhoNormalizado;

    return gcsStorage.getPublicUrl(caminhoNormalizado.replace(/^\/+/, ""));
}

/** Último dia do mês da data informada (UTC, meia-noite). */
function ultimoDiaDoMes(data: Date): Date {
    return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0));
}

export const processVendasIntegracaoAnalyzerJob: CronJobDefinition = {
    name: "Process Vendas Integracao Analyzer",
    key: "process_vendas_integracao_analyzer",
    label: "Vendas — Importar faturamentos do Analyzer",
    manualTrigger: true,
    schedule: Config.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER,
    enabled: Config.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_ENABLED,
    runOnInit: true,
    task: async () => {
        log.info("[ProcessVendasIntegracaoAnalyzer] Iniciando busca de faturamentos pendentes");

        const stageClient = dotzStageClient();
        const batchSize = Config.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_BATCH_SIZE;
        let ultimaChave: { OrigemRegistro: string; Id: Prisma.Decimal } | null = null;
        let recebidos = 0;
        let inseridos = 0;
        let atualizados = 0;

        while (true) {
            const where: Prisma.FaturamentoWhereInput = {
                StatusRegistro: STATUS_ANALYZER_PENDENTE,
                ...(ultimaChave && {
                    OR: [
                        { OrigemRegistro: { gt: ultimaChave.OrigemRegistro } },
                        {
                            OrigemRegistro: ultimaChave.OrigemRegistro,
                            Id: { gt: ultimaChave.Id },
                        },
                    ],
                }),
            };

            const faturamentos = await stageClient.faturamento.findMany({
                where,
                orderBy: [
                    { OrigemRegistro: "asc" },
                    { Id: "asc" },
                ],
                take: batchSize,
            });

            if (faturamentos.length === 0) break;

            recebidos += faturamentos.length;

            for (const faturamento of faturamentos) {
                const resultado = await processarRegistro(faturamento, stageClient);
                inseridos += resultado.inseridos;
                atualizados += resultado.atualizados;
            }

            const ultimoFaturamento = faturamentos[faturamentos.length - 1];
            ultimaChave = {
                OrigemRegistro: ultimoFaturamento.OrigemRegistro,
                Id: ultimoFaturamento.Id,
            };

            if (faturamentos.length < batchSize) break;
        }

        if (recebidos === 0) {
            log.info("[ProcessVendasIntegracaoAnalyzer] Nenhum faturamento pendente encontrado");
            return { totalReceived: 0, totalInserted: 0, totalUpdated: 0 };
        }

        log.info(
            `[ProcessVendasIntegracaoAnalyzer] Resumo: ${recebidos} recebidos, ${inseridos} inseridos e ${atualizados} atualizados no Analyzer`,
        );

        return {
            totalReceived: recebidos,
            totalInserted: inseridos,
            totalUpdated: atualizados,
        };
    },
};

async function processarRegistro(
    faturamento: Faturamento,
    stageClient: ReturnType<typeof dotzStageClient>,
): Promise<{ inseridos: number; atualizados: number }> {
    const companhia = faturamento.Companhia.trim();
    const codigoParceiro = faturamento.CodigoParceiro.toFixed(0);
    const numeroDocumento = faturamento.NumeroFatura.trim();
    let inseridos = 0;

    try {
        const vendaExistente = await s4DotzClient.vendasHeader.findFirst({
            where: {
                tipoCadastro: TIPO_CADASTRO_ANALYZER,
                ciaIdSAP: companhia,
                codigoClienteAnalyzer: codigoParceiro,
                numeroDocumentoAnalyzer: numeroDocumento,
            },
            select: { id: true },
        });

        if (!vendaExistente) {
            const detalhes = await stageClient.faturamentoDetalhe.findMany({
                where: {
                    OrigemRegistro: faturamento.OrigemRegistro,
                    FaturamentoId: faturamento.Id,
                },
                orderBy: { Id: "asc" },
            });

            await s4DotzClient.vendasHeader.create({
                data: {
                    tipoCadastro: TIPO_CADASTRO_ANALYZER,
                    status: StatusVendas.PENDENTE,
                    ciaIdSAP: companhia,
                    codigoClienteAnalyzer: codigoParceiro,
                    numeroDocumentoAnalyzer: numeroDocumento,
                    infoReferenciaAnalyzer: faturamento.TextoDocumento?.trim() || null,
                    valorTotalVendas: faturamento.ValorFatura.toString(),
                    pathArquivoFaturaDetalhadaAnalyzer: buildStorageUrl(
                        faturamento.CaminhoFaturaDetalhada,
                    ),
                    pathArquivoRelatorioAnalitico: buildStorageUrl(
                        faturamento.CaminhoFatura,
                    ),
                    // Último dia do mês da competência (PeriodoFechamentoDe), e não o
                    // PeriodoFechamentoAte — que é o 1º dia do mês seguinte (boundary exclusivo)
                    // e levava a data de emissão/lançamento para o mês errado.
                    dataEmissao: ultimoDiaDoMes(faturamento.PeriodoFechamentoDe),
                    dataLancamentoContabil: ultimoDiaDoMes(faturamento.PeriodoFechamentoDe),
                    dataFechamentoDe: faturamento.PeriodoFechamentoDe,
                    dataFechamentoAte: faturamento.PeriodoFechamentoAte,
                    cnpjCliente: faturamento.CnpjParceiro.trim(),
                    vendasDetalhe: detalhes.length > 0
                        ? {
                            create: detalhes.map((detalhe: FaturamentoDetalhe) => ({
                                itemDocumento: detalhe.FaturamentoId.toNumber(),
                                codigoProdutoDotz: detalhe.CodigoProduto?.trim() || null,
                                descricaoProduto: detalhe.DescricaoProduto?.trim() || null,
                                centroLucro: detalhe.CentroLucro?.trim() || null,
                                centroCusto: detalhe.CentroCusto?.trim() || null,
                                quantidadePontos: detalhe.QuantidadePontos.toNumber(),
                                valorVenda: detalhe.ValorTotalItem.toString(),
                                precoUnitario: detalhe.CustoUnitarioPonto.toString(),
                            })),
                        }
                        : undefined,
                },
            });
            inseridos = 1;
        } else {
            log.warn(
                `[ProcessVendasIntegracaoAnalyzer] Venda já importada para o faturamento ${faturamento.OrigemRegistro}/${faturamento.Id.toFixed(0)}; atualizando apenas o status no Analyzer`,
            );
        }

        await stageClient.faturamento.update({
            where: {
                OrigemRegistro_Id: {
                    OrigemRegistro: faturamento.OrigemRegistro,
                    Id: faturamento.Id,
                },
            },
            data: { StatusRegistro: STATUS_ANALYZER_INTEGRADO },
        });

        return { inseridos, atualizados: 0 };
    } catch (error) {
        log.error(
            `[ProcessVendasIntegracaoAnalyzer] Erro ao importar faturamento ${faturamento.OrigemRegistro}/${faturamento.Id.toFixed(0)}: %o`,
            error,
        );
        apm.captureError(error as Error);
        return { inseridos, atualizados: 0 };
    }
}
