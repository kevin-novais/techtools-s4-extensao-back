import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import log from "@/util/logger";
import type { RomaneioRow } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { parseToDecimal } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/utils/DecimalParser";

/**
 * Interface para representar os totais calculados do romaneio
 */
export interface TotaisRomaneio {
    valorTotalProdutos: Decimal;
    valorTotalPedido: Decimal;
    valorTotalFrete: Decimal;
    valorTotalCombo: Decimal;
}

/**
 * Serviço responsável por calcular totais a partir das linhas do romaneio
 * 
 * RESPONSABILIDADES:
 * - Somar valores de VLPROD (valor dos produtos)
 * - Somar valores de VLRPEDIDO (valor total do pedido)
 * - Somar valores de VLFRETE (valor do frete)
 * - Somar valores de COMBO (valor dos combos)
 * 
 * IMPORTANTE:
 * - Usa parseToDecimal para normalizar valores brasileiros
 * - Ignora valores nulos/inválidos na soma
 * - Retorna Decimal para precisão numérica
 */
export class TotaisRomaneioCalculator {
    /**
     * Calcula totais do romaneio somando valores de todas as linhas
     * 
     * @param rows - Linhas do romaneio
     * @returns Objeto com os 4 totais calculados
     */
    calcular(rows: RomaneioRow[]): TotaisRomaneio {
        let totalProdutos = new Decimal(0);
        let totalPedido = new Decimal(0);
        let totalFrete = new Decimal(0);
        let totalCombo = new Decimal(0);

        for (const row of rows) {
            const vlProd = parseToDecimal(row.VLPROD);
            const vlPedido = parseToDecimal(row.VLRPEDIDO);
            const vlFrete = parseToDecimal(row.VLFRETE);
            const vlCombo = parseToDecimal(row.COMBO);

            if (vlProd) totalProdutos = totalProdutos.plus(vlProd);
            if (vlPedido) totalPedido = totalPedido.plus(vlPedido);
            if (vlFrete) totalFrete = totalFrete.plus(vlFrete);
            if (vlCombo) totalCombo = totalCombo.plus(vlCombo);
        }

        log.info(
            `[TotaisRomaneioCalculator] Totais calculados: Produtos=${totalProdutos.toString()}, Pedido=${totalPedido.toString()}, Frete=${totalFrete.toString()}, Combo=${totalCombo.toString()}`
        );

        return {
            valorTotalProdutos: totalProdutos,
            valorTotalPedido: totalPedido,
            valorTotalFrete: totalFrete,
            valorTotalCombo: totalCombo,
        };
    }
}

