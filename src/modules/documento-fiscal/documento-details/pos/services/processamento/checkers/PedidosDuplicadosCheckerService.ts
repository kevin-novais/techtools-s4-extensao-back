import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { chunkArray } from "@/util/chunkArray";

/**
 * Serviço responsável por verificar se pedidos POS já foram vinculados a outros documentos
 * 
 * RESPONSABILIDADES:
 * - Verificar duplicação de pedidos em outros documentos POS da mesma CIA e fornecedor
 * - Fazer verificação em UMA ÚNICA query (evita N+1)
 * - Retornar Set para lookup O(1) durante validação
 * 
 * REGRA DE NEGÓCIO:
 * Um pedido POS não pode estar vinculado a mais de um documento com:
 * - Mesmo CIA_ID
 * - Mesmo CODIGO_FORNECEDOR_SAP
 * - TIPO_PROCESSO = 'TP_POS'
 * 
 * PERFORMANCE:
 * - Query única com JOIN entre detail → header
 * - Usa distinct para evitar duplicatas
 * - Early return se lista estiver vazia
 */
export class PedidosDuplicadosCheckerService {
    /**
     * Verifica quais pedidos POS já estão vinculados a outros documentos
     * 
     * @param pedidosUnicos - Lista de códigos de pedidos únicos para verificar (U_POS_ID)
     * @param ciaId - ID da CIA do documento atual
     * @param codigoFornecedorSAP - Código do fornecedor SAP do documento atual
     * @param documentoHeaderIdAtual - ID do header do documento atual (para excluir da busca)
     * @returns Set com pedidos que já estão vinculados a outros documentos
     */
    async execute(
        pedidosUnicos: string[],
        ciaId: number,
        codigoFornecedorSAP: string,
        documentoHeaderIdAtual: number
    ): Promise<Set<string>> {
        // Early return: Lista vazia não precisa verificar
        if (pedidosUnicos.length === 0) {
            return new Set<string>();
        }

        log.info(
            `[PedidosDuplicadosCheckerService:POS] Verificando duplicação de ${pedidosUnicos.length} pedidos`
        );

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const chunks = chunkArray(pedidosUnicos);
        const todosPedidosDuplicados = [];

        log.info(`[PedidosDuplicadosCheckerService:POS] Verificando ${pedidosUnicos.length} pedidos em ${chunks.length} chunk(s)`);

        // PERFORMANCE: Query única com JOIN busca todos os pedidos duplicados de uma vez
        // Busca detalhes que têm pedidos da lista E estão em headers diferentes com mesma CIA/fornecedor
        for (const chunk of chunks) {
            const resultado = await s4DotzClient.documentoFiscalDetalhe.findMany({
                where: {
                    codigoPedidoParceiro: {
                        in: chunk,
                    },
                    documentoFiscalHeader: {
                        id: {
                            not: documentoHeaderIdAtual, // Exclui o documento atual
                        },
                        ciaId: ciaId,
                        codigoFornecedorSAP: codigoFornecedorSAP,
                        tipoDocumentoERP: TipoProcesso.TP_POS,
                    },
                },
                select: {
                    codigoPedidoParceiro: true,
                },
                distinct: ["codigoPedidoParceiro"],
            });
            todosPedidosDuplicados.push(...resultado);
        }

        // Converte resultado para Set de strings para lookup O(1)
        const pedidosSet = new Set<string>();
        for (const detalhe of todosPedidosDuplicados) {
            if (detalhe.codigoPedidoParceiro) {
                pedidosSet.add(detalhe.codigoPedidoParceiro);
            }
        }

        log.info(
            `[PedidosDuplicadosCheckerService:POS] ${pedidosSet.size} pedidos duplicados encontrados`
        );

        return pedidosSet;
    }
}
