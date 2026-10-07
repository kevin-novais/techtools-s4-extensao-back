import type { PedidoAnalyzerData, RomaneioRow, ValidacaoItensResult, ErrorWithCode } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { ItemPOR1Validator } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/ItemPOR1Validator";

/**
 * Validador responsável por validar itens do pedido (POR1 - Linhas do Pedido de Compra)
 * 
 * REGRAS DE NEGÓCIO:
 * 1. Pedido deve ter ao menos um item (POR1)
 * 2. Usa o primeiro item do pedido (POR1[0]) para extração de dados
 * 3. Delega validação de detalhes para ItemPOR1Validator
 *
 * COMPORTAMENTO:
 * - Divergências não bloqueiam processamento
 * - Retorna DocEntry se item encontrado, null caso contrário
 * - Todas as divergências são coletadas e retornadas
 */
export class ItensPedidoValidator {
    private readonly itemPOR1Validator: ItemPOR1Validator;

    constructor() {
        this.itemPOR1Validator = new ItemPOR1Validator();
    }

    /**
     * Valida itens do pedido
     * 
     * @param pedidoAnalyzer - Dados do pedido buscados no Analyzer
     * @param pedidoParceiro - Número do pedido do parceiro
     * @param row - Linha do romaneio sendo validada
     * @returns Objeto com DocEntry do item (se encontrado) e array de divergências
     */
    validar(pedidoAnalyzer: PedidoAnalyzerData, pedidoParceiro: number, row: RomaneioRow): ValidacaoItensResult {
        const divergencias: ErrorWithCode[] = [];

        // VALIDAÇÃO 3.1: Pedido deve ter itens (POR1)
        if (!pedidoAnalyzer.POR1 || pedidoAnalyzer.POR1.length === 0) {
            divergencias.push({
                code: "07",
                message: `Detalhe do pedido '${pedidoParceiro}' não encontrado (POR1)`,
            });
            return { docEntry: null, divergencias };
        }

        // Usa o primeiro item do pedido (POR1[0]) para extração de dados
        // A coluna PRODUTO do romaneio não é mais usada para localizar o item
        const por1Item = pedidoAnalyzer.POR1[0];
        const itemProduto = String(por1Item.U_PRODUTO ?? "");

        // VALIDAÇÃO 3.3: Valida detalhes do item encontrado
        const divergenciasItem = this.itemPOR1Validator.validar(por1Item, itemProduto, row);
        divergencias.push(...divergenciasItem);

        return {
            docEntry: String(por1Item.DocEntry),
            divergencias,
        };
    }
}

