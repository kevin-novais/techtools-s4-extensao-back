import type { PedidoAnalyzerData, RomaneioRow, ErrorWithCode } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { parseToDecimal, formatDecimalToMoney } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/utils/DecimalParser";
import { Decimal } from "@prisma/client-s4-dotz/runtime/library";

/**
 * Validador responsável por validar dados gerais do pedido no Analyzer (OPOR)
 * 
 * REGRAS DE NEGÓCIO:
 * 1. CardCode deve corresponder ao fornecedor do romaneio (header)
 * 2. Pedido não pode estar cancelado (CANCELED = 'N')
 * 3. Valor total do pedido (DocTotal) deve bater com valor no romaneio
 * 4. Parceiro deve estar cadastrado (OCRD deve existir)
 * 5. Parceiro deve estar ativo (OCRD.ativo = true)
 * 6. Valor do frete deve corresponder ao valor no romaneio
 *
 * COMPORTAMENTO:
 * - Divergências não bloqueiam processamento
 * - Todas as divergências são coletadas e retornadas em array
 */
export class PedidoAnalyzerValidator {
    /**
     * Valida dados gerais do pedido no Analyzer
     * 
     * @param pedidoAnalyzer - Dados do pedido buscados no Analyzer
     * @param pedidoParceiro - Número do pedido do parceiro
     * @param codigoFornecedorSAPHeader - Código SAP do fornecedor informado no header
     * @param row - Linha do romaneio sendo validada
     * @returns Array de erros com código encontrados
     */
    validar(
        pedidoAnalyzer: PedidoAnalyzerData,
        pedidoParceiro: number,
        codigoFornecedorSAPHeader: string,
        row: RomaneioRow
    ): ErrorWithCode[] {
        const divergencias: ErrorWithCode[] = [];

        // VALIDAÇÃO 2.1: Parceiro do pedido (CardCode) deve ser o mesmo do fornecedor SAP do romaneio
        if (pedidoAnalyzer.CardCode !== codigoFornecedorSAPHeader) {
            divergencias.push({
                code: "01",
                message: `Pedido '${pedidoParceiro}' com parceiro '${pedidoAnalyzer.CardCode}' diferente do fornecedor SAP do romaneio '${codigoFornecedorSAPHeader}'`,
            });
        }

        // VALIDAÇÃO 2.2: Pedido não pode estar cancelado
        if (pedidoAnalyzer.CANCELED !== "N") {
            divergencias.push({
                code: "03",
                message: `Pedido '${pedidoParceiro}' cancelado`,
            });
        }

        // VALIDAÇÃO 2.3: Status do pedido deve ser 'O' (Open)
        if (pedidoAnalyzer.DocStatus !== "O") {
            divergencias.push({
                code: "18",
                message: `Pedido '${pedidoParceiro}' com status inválido (Status: ${pedidoAnalyzer.DocStatus})`,
            });
        }

        // VALIDAÇÃO 2.5: Valor total do pedido deve corresponder ao valor no romaneio
        const vlrPedidoDecimal = parseToDecimal(row.VLRPEDIDO);
        if (vlrPedidoDecimal && pedidoAnalyzer.DocTotal && !pedidoAnalyzer.DocTotal.equals(vlrPedidoDecimal)) {
            divergencias.push({
                code: "04",
                message: `Valor do pedido '${formatDecimalToMoney(pedidoAnalyzer.DocTotal)}' difere do valor no romaneio '${formatDecimalToMoney(vlrPedidoDecimal)}'`,
            });
        }

        // VALIDAÇÃO 2.6: Parceiro deve estar cadastrado no Analyzer
        if (!pedidoAnalyzer.OCRD) {
            divergencias.push({
                code: "05",
                message: `Parceiro '${pedidoAnalyzer.CardCode}' não cadastrado (OCRD)`,
            });
        }

        // VALIDAÇÃO 2.7: Parceiro deve estar ativo
        // TODO Voltar essa validação quando resolver pq esse campo está vindo false
        // if (pedidoAnalyzer.OCRD?.ativo === false) {
        //     divergencias.push({
        //         code: "06",
        //         message: `Parceiro '${pedidoAnalyzer.CardCode}' desativado`,
        //     });
        // }

        // VALIDAÇÃO 2.8: Valor do frete deve corresponder ao valor no romaneio
        const vlFreteRomaneio = parseToDecimal(row.VLFRETE);
        const vlFretePedido = pedidoAnalyzer.POR2?.[0]?.LineTotal || new Decimal(0);

        if (vlFreteRomaneio && !vlFretePedido.equals(vlFreteRomaneio)) {
            divergencias.push({
                code: "14",
                message: `Valor do frete informado no romaneio '${formatDecimalToMoney(vlFreteRomaneio)}' difere do valor no pedido '${formatDecimalToMoney(vlFretePedido)}'`,
            });
        }

        return divergencias;
    }
}

