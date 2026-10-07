import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import type { ConfiguracaoContabilData, ConfigDetalhe } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

/**
 * Serviço responsável por buscar configurações contábeis do banco de dados
 * 
 * RESPONSABILIDADES:
 * - Buscar configuração contábil por ciaId e tipoDocumentoERP
 * - Carregar detalhes em uma única query (JOIN com include)
 * - Organizar configs em Maps para lookup O(1) durante processamento
 * - Priorizar configs específicas (com codigoItem) sobre genéricas
 * 
 * ESTRATÉGIA DE PERFORMANCE:
 * - Uma única query com include (evita N+1)
 * - Maps indexados para busca O(1) vs busca linear O(n)
 * - Separação entre configs específicas e genéricas para lookup eficiente
 */
export class ConfiguracaoContabilFetcherService {
    /**
     * Busca configurações contábeis para um tipo de processo e CIA
     * Retorna dados estruturados em Maps para lookup O(1)
     * 
     * @param ciaId - ID da CIA
     * @param tipoDocumentoERP - Tipo de documento ERP (ex: "TP_ROM", "DR", "PD", "RD")
     * @returns Dados de configuração contábil estruturados
     * @throws Error se configuração não encontrada
     */
    async execute(ciaId: number, tipoProcesso: string): Promise<ConfiguracaoContabilData> { // string pois vem do Prisma
        log.info(
            `[ConfiguracaoContabilFetcherService] Buscando configs para CIA ${ciaId}, tipoProcesso ${tipoProcesso}`
        );

        // Busca configuração com detalhes em uma única query (performance)
        const config = await s4DotzClient.configuracaoContabil.findUnique({
            where: {
                ciaId_tipoProcesso: {
                    ciaId,
                    tipoProcesso,
                },
            },
            include: {
                configuracaoContabilDetalhes: true,
            },
        });

        // Early return: configuração não encontrada
        if (!config) {
            throw new Error(
                `Configuração contábil não encontrada para CIA ${ciaId} e tipoProcesso ${tipoProcesso}`
            );
        }

        // Organiza detalhes em Maps para lookup O(1)
        const configsPorGrupoEItem = new Map<string, ConfigDetalhe>();
        const configsGenericasPorGrupo = new Map<string, ConfigDetalhe>();
        const configsPorCodigoProdutoManual = new Map<string, ConfigDetalhe>();

        for (const detalhe of config.configuracaoContabilDetalhes) {
            const configDetalhe: ConfigDetalhe = {
                id: detalhe.id,
                grupoPisCofins: detalhe.grupoPisCofins,
                codigoItem: detalhe.codigoItem,
                validarDivergencia: detalhe.validarDivergencia,
                aliquotaPis: detalhe.aliquotaPis?.toNumber() ?? null,
                aliquotaCofins: detalhe.aliquotaCofins?.toNumber() ?? null,
                contaCreditoPis: detalhe.contaCreditoPis,
                contaDebitoPis: detalhe.contaDebitoPis,
                contaCreditoCofins: detalhe.contaCreditoCofins,
                contaDebitoCofins: detalhe.contaDebitoCofins,
                contaCreditoValorProduto: detalhe.contaCreditoValorProduto,
                contaDebitoValorProduto: detalhe.contaDebitoValorProduto,
                contaCreditoValorFrete: detalhe.contaCreditoValorFrete,
                contaDebitoValorFrete: detalhe.contaDebitoValorFrete,
                contaCreditoValorCombo: detalhe.contaCreditoValorCombo,
                contaDebitoValorCombo: detalhe.contaDebitoValorCombo,
                contaCreditoValorIs: detalhe.contaCreditoValorIs,
                contaDebitoValorIs: detalhe.contaDebitoValorIs,
                contaCreditoValorCbs: detalhe.contaCreditoValorCbs,
                contaDebitoValorCbs: detalhe.contaDebitoValorCbs,
                contaCreditoValorIbsUf: detalhe.contaCreditoValorIbsUf,
                contaDebitoValorIbsUf: detalhe.contaDebitoValorIbsUf,
                contaCreditoValorIbsMunicipal: detalhe.contaCreditoValorIbsMunicipal,
                contaDebitoValorIbsMunicipal: detalhe.contaDebitoValorIbsMunicipal,
                centroCusto: detalhe.centroCusto,
                centroLucro: detalhe.centroLucro,
            };

            if (detalhe.codigoItem) {
                // Config específica para item (prioridade alta)
                const key = `${detalhe.grupoPisCofins}|${detalhe.codigoItem}`;
                configsPorGrupoEItem.set(key, configDetalhe);
                // Linhas manuais: codigoItem + validarDivergencia=false
                if (!detalhe.validarDivergencia) {
                    configsPorCodigoProdutoManual.set(detalhe.codigoItem, configDetalhe);
                }
            } else {
                // Config genérica para o grupo (fallback)
                configsGenericasPorGrupo.set(detalhe.grupoPisCofins, configDetalhe);
            }
        }

        log.info(
            `[ConfiguracaoContabilFetcherService] ${config.configuracaoContabilDetalhes.length} configurações carregadas (${configsPorGrupoEItem.size} específicas, ${configsGenericasPorGrupo.size} genéricas)`
        );

        log.info(
            `[ConfiguracaoContabilFetcherService] ${configsPorCodigoProdutoManual.size} configs para linhas manuais (validarDivergencia=false)`
        );

        return {
            header: {
                textoHeaderContabil: config.textoHeaderContabil,
                periodoDeDiferimento: config.periodoDeDiferimento,
                tipoContabilERP: config.tipoContabilERP,
            },
            configsPorGrupoEItem,
            configsGenericasPorGrupo,
            configsPorCodigoProdutoManual,
        };
    }
}

