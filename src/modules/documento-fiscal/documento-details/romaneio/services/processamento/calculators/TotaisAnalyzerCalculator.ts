import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import log from "@/util/logger";
import type { PedidoAnalyzerData, TotaisAnalyzer } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

/**
 * Serviço responsável por calcular totais a partir dos dados do Analyzer (stage)
 * 
 * RESPONSABILIDADES:
 * - Somar valores de Price * Quantity dos itens (POR1) de todos os pedidos
 * - Somar valores de DocTotal (valor total do pedido) de todos os pedidos
 * - Somar valores de LineTotal do frete (POR2) de todos os pedidos
 * - Combo não existe no Analyzer, retorna null
 * 
 * IMPORTANTE:
 * - Apenas soma valores dos pedidos presentes no Map (pedidos do romaneio)
 * - Ignora valores nulos/inválidos na soma
 * - Retorna Decimal para precisão numérica
 * 
 * PERFORMANCE:
 * - Reutiliza dados já buscados do Analyzer (evita nova query)
 * - Complexidade O(n) onde n é o número de pedidos + itens
 */
export class TotaisAnalyzerCalculator {
    /**
     * Calcula totais do Analyzer somando valores de todos os pedidos
     * 
     * @param pedidosAnalyzer - Map com dados dos pedidos já buscados do Analyzer
     * @returns Objeto com os 4 totais calculados (combo será null)
     */
    execute(pedidosAnalyzer: Map<number, PedidoAnalyzerData>): TotaisAnalyzer {
        log.info(`[TotaisAnalyzerCalculator] Calculando totais do Analyzer para ${pedidosAnalyzer.size} pedidos`);

        let totalProdutos = new Decimal(0);
        let totalPedido = new Decimal(0);
        let totalFrete = new Decimal(0);

        // Itera sobre cada pedido do Analyzer presente no romaneio
        for (const [pedidoNumero, pedido] of pedidosAnalyzer) {
            // TOTAL DE PRODUTOS: Soma Price * Quantity de cada item (POR1)
            if (pedido.POR1 && pedido.POR1.length > 0) {
                for (const item of pedido.POR1) {
                    if (item.Price && item.Quantity) {
                        const valorItem = item.Price.times(item.Quantity);
                        totalProdutos = totalProdutos.plus(valorItem);
                    }
                }
            }

            // TOTAL DO PEDIDO: Soma DocTotal de cada pedido (OPOR)
            if (pedido.DocTotal) {
                totalPedido = totalPedido.plus(pedido.DocTotal);
            }

            // TOTAL DO FRETE: Soma LineTotal das despesas (POR2)
            if (pedido.POR2?.[0]?.LineTotal) {
                totalFrete = totalFrete.plus(pedido.POR2[0].LineTotal);
            }
        }

        log.info(
            `[TotaisAnalyzerCalculator] Totais calculados: Produtos=${totalProdutos.toString()}, Pedido=${totalPedido.toString()}, Frete=${totalFrete.toString()}, Combo=null`
        );

        return {
            valorTotalProdutosAnalyzer: totalProdutos,
            valorTotalPedidoAnalyzer: totalPedido,
            valorTotalFreteAnalyzer: totalFrete,
            valorTotalComboAnalyzer: null, // Combo não existe no Analyzer
        };
    }
}

