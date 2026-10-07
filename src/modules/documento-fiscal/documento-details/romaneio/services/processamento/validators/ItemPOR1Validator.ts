import type { PedidoAnalyzerData, RomaneioRow, ErrorWithCode } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { parseToDecimal, formatDecimalToMoney } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/utils/DecimalParser";

/**
 * Validador responsável por validar detalhes de um item específico do pedido
 * 
 * REGRAS DE NEGÓCIO:
 * 1. Status da linha deve ser "O" (aberto)
 * 2. Pedido não deve estar integrado (U_DocEntryNF = null)
 * 3. Preço unitário deve corresponder ao valor do produto no romaneio
 * 4. Quantidade no pedido deve corresponder à quantidade no romaneio
 * 5. Produto deve estar cadastrado (OITM)
 * 6. Produto não pode estar deletado (Deleted = 'N')
 * 7. Configuração do produto deve ser válida (U_Seidor_PC_Calcula = 1 ou 2)
 * 
 * COMPORTAMENTO:
 * - Divergências não bloqueiam processamento
 * - Se OITM não existe, não valida propriedades do OITM (early return)
 * - Todas as divergências são coletadas e retornadas em array
 */
export class ItemPOR1Validator {
    /**
     * Valida detalhes de um item específico do pedido
     * 
     * @param por1Item - Item do pedido (POR1) a ser validado
     * @param itemProduto - Código do produto no romaneio
     * @param row - Linha do romaneio sendo validada
     * @returns Array de erros com código encontrados
     */
    validar(por1Item: PedidoAnalyzerData["POR1"][number], itemProduto: string, row: RomaneioRow): ErrorWithCode[] {
        const divergencias: ErrorWithCode[] = [];

        // VALIDAÇÃO 3.3.1: Status da linha deve ser "O" (aberto)
        if (por1Item.LineStatus && por1Item.LineStatus !== "O") {
            divergencias.push({
                code: "10",
                message: `Status detalhe do Pedido '${row.PEDIDO_PARCEIRO}' inválido (Status: ${por1Item.LineStatus})`,
            });
        }

        // VALIDAÇÃO 3.3.2: Pedido não deve estar integrado no SAP
        if (por1Item.U_DocEntryNF !== null && por1Item.U_DocEntryNF !== undefined) {
            divergencias.push({
                code: "12",
                message: `Pedido '${row.PEDIDO_PARCEIRO}' já foi integrado no SAP (DocEntryNF: ${por1Item.U_DocEntryNF})`,
            });
        }

        // VALIDAÇÃO 3.3.3: Preço unitário deve corresponder ao valor do produto no romaneio
        const vlProdDecimal = parseToDecimal(row.VLPROD);
        if (vlProdDecimal && por1Item.Price && !por1Item.Price.equals(vlProdDecimal)) {
            divergencias.push({
                code: "09",
                message: `Preço do produto '${itemProduto}' no pedido '${formatDecimalToMoney(por1Item.Price)}' difere do valor no romaneio '${formatDecimalToMoney(vlProdDecimal)}'`,
            });
        }

        // VALIDAÇÃO 3.3.4: Quantidade no pedido deve corresponder à do romaneio
        const qtdProdDecimal = parseToDecimal(row.QTDPROD);
        if (qtdProdDecimal && por1Item.Quantity && !por1Item.Quantity.equals(qtdProdDecimal)) {
            divergencias.push({
                code: "08",
                message: `Quantidade no pedido '${por1Item.Quantity.toString()}' difere da quantidade no romaneio '${qtdProdDecimal.toString()}'`,
            });
        }

        // VALIDAÇÃO 3.3.5: Produto deve estar cadastrado no Analyzer (OITM)
        if (!por1Item.OITM) {
            divergencias.push({
                code: "15",
                message: `Produto '${por1Item.ItemCode}' não cadastrado (OITM)`,
            });
            return divergencias; // Early return: Não valida propriedades do OITM se não existe
        }

        // VALIDAÇÃO 3.3.7: Produto não pode estar deletado
        if (por1Item.OITM.Deleted !== "N") {
            divergencias.push({
                code: "16",
                message: `Produto '${por1Item.OITM.ItemCode}' está deletado`,
            });
        }

        // VALIDAÇÃO 3.3.8: Configuração do produto deve ser válida (U_Seidor_PC_Calcula = 1 ou 2)
        if (por1Item.OITM.U_Seidor_PC_Calcula !== 1 && por1Item.OITM.U_Seidor_PC_Calcula !== 2) {
            divergencias.push({
                code: "17",
                message: `Produto '${por1Item.OITM.ItemCode}' não configurado corretamente na tabela OITM (U_Seidor_PC_Calcula: ${por1Item.OITM.U_Seidor_PC_Calcula})`,
            });
        }

        return divergencias;
    }
}

