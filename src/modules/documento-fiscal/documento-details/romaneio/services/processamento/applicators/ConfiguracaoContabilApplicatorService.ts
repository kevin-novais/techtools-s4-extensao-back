import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import type { DetalheParaInserir, ConfiguracaoContabilData, ErrorWithCode, ConfigDetalhe } from "../types/ProcessamentoTypes";

/**
 * Serviço responsável por aplicar configuração contábil aos detalhes do documento fiscal
 * 
 * RESPONSABILIDADES:
 * - Buscar configuração apropriada (específica ou genérica)
 * - Aplicar contas contábeis ao detalhe
 * - Calcular valores de PIS/COFINS quando aplicável
 * - Gerar erros de validação quando configuração não encontrada
 * 
 * REGRAS DE NEGÓCIO:
 * - Prioridade: Config específica (com codigoItem) > Config genérica (sem codigoItem)
 * - PIS/COFINS só é calculado se grupoPisCofins = 'S'
 * - Ausência de grupoPisCofins ou configuração gera ERRO crítico
 */
export class ConfiguracaoContabilApplicatorService {
    /**
     * Aplica configuração contábil a um detalhe do documento fiscal
     * Modifica o objeto detalhe in-place adicionando contas contábeis e cálculos
     *
     * @param detalhe - Detalhe do documento fiscal a ser enriquecido
     * @param configData - Dados de configuração contábil carregados
     * @param options - isLinhaManual: true para linhas manuais (lookup por codigoProdutoRomaneio)
     * @returns Divergências encontradas e ID da configuração aplicada (se houver)
     */
    execute(
        detalhe: DetalheParaInserir,
        configData: ConfiguracaoContabilData,
        options?: { isLinhaManual?: boolean }
    ): { divergencias: ErrorWithCode[]; configuracaoContabilDetalheId: number | null } {
        const divergencias: ErrorWithCode[] = [];

        // Linha manual: lookup por codigoProdutoRomaneio em configsPorCodigoProdutoManual
        if (options?.isLinhaManual && detalhe.codigoProdutoRomaneio) {
            const config = configData.configsPorCodigoProdutoManual.get(detalhe.codigoProdutoRomaneio);

            if (!config) {
                divergencias.push({
                    code: "21",
                    message: `Configuração contábil não encontrada para produto manual '${detalhe.codigoProdutoRomaneio}'`,
                });
                return { divergencias, configuracaoContabilDetalheId: null };
            }

            this.aplicarContasContabeis(detalhe, config);
            return { divergencias, configuracaoContabilDetalheId: config.id };
        }

        // Early return: sem grupoPisCofins, não pode aplicar config (fluxo normal)
        if (!detalhe.grupoPisCofins) {
            divergencias.push({
                code: "20",
                message: "Grupo PIS/COFINS não identificado no produto",
            });
            return { divergencias, configuracaoContabilDetalheId: null };
        }

        // Busca configuração apropriada (específica ou genérica)
        const config = this.buscarConfiguracao(detalhe, configData);

        // Early return: configuração não encontrada (ERRO crítico)
        if (!config) {
            const mensagemErro = detalhe.codigoProdutoDotz
                ? `Configuração contábil não encontrada para grupo PIS/COFINS '${detalhe.grupoPisCofins}' e produto '${detalhe.codigoProdutoDotz}'`
                : `Configuração contábil não encontrada para grupo PIS/COFINS '${detalhe.grupoPisCofins}'`;

            divergencias.push({
                code: "21",
                message: mensagemErro,
            });
            return { divergencias, configuracaoContabilDetalheId: null };
        }

        // Aplica contas contábeis ao detalhe
        this.aplicarContasContabeis(detalhe, config);

        // Calcula PIS/COFINS se aplicável
        this.calcularPisCofins(detalhe, config);

        return { divergencias, configuracaoContabilDetalheId: config.id };
    }

    /**
     * Busca configuração apropriada seguindo ordem de prioridade
     * 1. Tenta buscar configuração específica para o item (grupoPisCofins + codigoItem)
     * 2. Se não encontrar, busca configuração genérica (apenas grupoPisCofins)
     * 
     * @param detalhe - Detalhe do documento fiscal
     * @param configData - Dados de configuração contábil
     * @returns Configuração encontrada ou null
     */
    private buscarConfiguracao(
        detalhe: DetalheParaInserir,
        configData: ConfiguracaoContabilData
    ): ConfigDetalhe | null {
        // Early return: sem grupoPisCofins, não pode buscar config
        if (!detalhe.grupoPisCofins) {
            return null;
        }

        // Tenta buscar configuração específica para o item
        if (detalhe.codigoProdutoDotz) {
            const configKey = `${detalhe.grupoPisCofins}|${detalhe.codigoProdutoDotz}`;
            const configEspecifica = configData.configsPorGrupoEItem.get(configKey);

            if (configEspecifica) {
                return configEspecifica;
            }
        }

        // Fallback: busca configuração genérica para o grupo
        const configGenerica = configData.configsGenericasPorGrupo.get(detalhe.grupoPisCofins);

        if (configGenerica) {
            return configGenerica;
        }

        // Não encontrou nenhuma configuração
        return null;
    }

    /**
     * Aplica todas as contas contábeis ao detalhe
     * Modifica o objeto detalhe in-place
     * 
     * @param detalhe - Detalhe do documento fiscal
     * @param config - Configuração contábil a ser aplicada
     */
    private aplicarContasContabeis(detalhe: DetalheParaInserir, config: ConfigDetalhe): void {
        // Custo (Produto)
        detalhe.contaContabilCreditoCusto = config.contaCreditoValorProduto;
        detalhe.contaContabilDebitoCusto = config.contaDebitoValorProduto;

        // Frete
        detalhe.contaContabilCreditoFrete = config.contaCreditoValorFrete;
        detalhe.contaContabilDebitoFrete = config.contaDebitoValorFrete;

        // Combo
        detalhe.contaContabilCreditoCombo = config.contaCreditoValorCombo;
        detalhe.contaContabilDebitoCombo = config.contaDebitoValorCombo;

        // PIS
        detalhe.contaContabilCreditoPis = config.contaCreditoPis;
        detalhe.contaContabilDebitoPis = config.contaDebitoPis;

        // COFINS
        detalhe.contaContabilCreditoCofins = config.contaCreditoCofins;
        detalhe.contaContabilDebitoCofins = config.contaDebitoCofins;

        // IS
        detalhe.contaContabilCreditoValorIs = config.contaCreditoValorIs;
        detalhe.contaContabilDebitoValorIs = config.contaDebitoValorIs;

        // CBS
        detalhe.contaContabilCreditoValorCbs = config.contaCreditoValorCbs;
        detalhe.contaContabilDebitoValorCbs = config.contaDebitoValorCbs;

        // IBS UF
        detalhe.contaContabilCreditoValorIbsUf = config.contaCreditoValorIbsUf;
        detalhe.contaContabilDebitoValorIbsUf = config.contaDebitoValorIbsUf;

        // IBS Municipal
        detalhe.contaContabilCreditoValorIbsMunicipal = config.contaCreditoValorIbsMunicipal;
        detalhe.contaContabilDebitoValorIbsMunicipal = config.contaDebitoValorIbsMunicipal;

        // Centro de Custo e Centro de Lucro
        detalhe.centroCusto = config.centroCusto;
        detalhe.centroLucro = config.centroLucro;
    }

    /**
     * Calcula valores de PIS e COFINS quando aplicável
     * 
     * REGRA: Só calcula se grupoPisCofins = 'S' (Sim, calcula)
     * 
     * FÓRMULAS:
     * - valorPisOperacaoCredor = valorPedido * (aliquotaPis / 100)
     * - valorCofinsOperacaoCredor = valorPedido * (aliquotaCofins / 100)
     * 
     * @param detalhe - Detalhe do documento fiscal
     * @param config - Configuração contábil com alíquotas
     */
    private calcularPisCofins(detalhe: DetalheParaInserir, config: ConfigDetalhe): void {
        // Early return: só calcula se grupo PIS/COFINS = 'S' (Sim, calcula)
        if (detalhe.grupoPisCofins !== "S") {
            return;
        }

        // Early return: só calcula se tiver valor de pedido
        if (!detalhe.valorPedido) {
            return;
        }

        const valorPedido = new Decimal(detalhe.valorPedido);

        // Calcula PIS: VALOR_PEDIDO * (ALIQUOTA_PIS / 100)
        if (config.aliquotaPis) {
            const aliquotaPis = new Decimal(config.aliquotaPis);
            detalhe.valorPisOperacaoCredor = valorPedido.mul(aliquotaPis).div(100).toNumber();
        }

        // Calcula COFINS: VALOR_PEDIDO * (ALIQUOTA_COFINS / 100)
        if (config.aliquotaCofins) {
            const aliquotaCofins = new Decimal(config.aliquotaCofins);
            detalhe.valorCofinsOperacaoCredor = valorPedido.mul(aliquotaCofins).div(100).toNumber();
        }
    }
}

