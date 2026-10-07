import getDotzStageClient from "@/database/clients/dotzStageClient";
import log from "@/util/logger";
import type { PedidoAnalyzerData } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { chunkArray } from "@/util/chunkArray";

/**
 * Serviço responsável por buscar dados de pedidos no Analyzer
 * 
 * RESPONSABILIDADES:
 * - Buscar todos os pedidos em UMA ÚNICA query (evita N+1)
 * - Fazer JOINs para carregar dados relacionados (OCRD, POR1, OITM)
 * - Retornar Map para lookup O(1) durante validação
 * 
 * PERFORMANCE:
 * Usa include do Prisma para fazer JOINs:
 * - OPOR (Pedido) → OCRD (Parceiro)
 * - OPOR → POR1 (Itens do Pedido) → OITM (Cadastro de Produto)
 */
export class AnalyzerDataFetcherService {
    /**
     * Busca todos os pedidos do Analyzer em UMA ÚNICA query com JOINs
     * 
     * @param pedidosUnicos - Lista de números de pedidos únicos para buscar
     * @returns Map com dados dos pedidos indexados por número do pedido
     */
    async execute(pedidosUnicos: number[]): Promise<Map<number, PedidoAnalyzerData>> {
        log.info(`[AnalyzerDataFetcherService] Buscando dados do Analyzer para ${pedidosUnicos.length} pedidos`);

        const dotzStageClient = getDotzStageClient();

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const chunks = chunkArray(pedidosUnicos);
        const todosPedidos = [];

        log.info(`[AnalyzerDataFetcherService] Buscando ${pedidosUnicos.length} pedidos em ${chunks.length} chunk(s)`);

        // PERFORMANCE: Uma única query com JOINs carrega todos os dados necessários
        for (const chunk of chunks) {
            const pedidosChunk = await dotzStageClient.oPOR.findMany({
                where: {
                    U_DOTZNRPED: { in: chunk },
                },
                select: {
                    U_DOTZNRPED: true,
                    CardCode: true,
                    CANCELED: true,
                    DocStatus: true,
                    DocTotal: true,
                    DocEntry: true,
                    // JOIN: Dados do parceiro (fornecedor)
                    OCRD: {
                        select: { 
                            CardCode: true,
                            ativo: true,
                        },
                    },
                    // JOIN: Itens do pedido
                    POR1: {
                        select: {
                            DocEntry: true,
                            Quantity: true,
                            U_PRODUTO: true,
                            ItemCode: true,
                            LineStatus: true,
                            U_DocEntryNF: true,
                            Price: true,
                            // JOIN: Cadastro do produto
                            OITM: {
                                select: {
                                    ItemCode: true,
                                    Deleted: true,
                                    U_Seidor_PC_Calcula: true,
                                    U_Seidor_PC_Analisa: true,
                                    SuppCatNum: true,
                                },
                            },
                        },
                    },
                    // JOIN: Despesas do pedido (frete)
                    POR2: {
                        select: {
                            LineTotal: true,
                            ExpnsCode: true,
                        },
                    },
                },
            });
            todosPedidos.push(...pedidosChunk);
        }

        // Converte array para Map para lookup O(1) por número de pedido
        const pedidosMap = new Map<number, PedidoAnalyzerData>();
        for (const pedido of todosPedidos) {
            if (pedido.U_DOTZNRPED !== null) {
                pedidosMap.set(pedido.U_DOTZNRPED, pedido);
            }
        }

        log.info(`[AnalyzerDataFetcherService] Dados do Analyzer carregados: ${pedidosMap.size} pedidos encontrados`);
        return pedidosMap;
    }
}

