import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { chunkArray } from "@/util/chunkArray";

/**
 * Serviço responsável por verificar se pedidos já foram vinculados a outros romaneios
 * 
 * RESPONSABILIDADES:
 * - Verificar duplicação de pedidos em outros romaneios da mesma CIA e fornecedor
 * - Fazer verificação em UMA ÚNICA query (evita N+1)
 * - Retornar Set para lookup O(1) durante validação
 * 
 * REGRA DE NEGÓCIO:
 * Um pedido não pode estar vinculado a mais de um romaneio com:
 * - Mesmo CIA_ID
 * - Mesmo CODIGO_FORNECEDOR_SAP
 * - TIPO_PROCESSO = 'TP_ROM'
 * 
 * PERFORMANCE:
 * - Query única com JOIN entre detail → header
 * - Usa distinct para evitar duplicatas
 * - Early return se lista estiver vazia
 */
export class PedidosDuplicadosCheckerService {
    /**
     * Verifica quais pedidos já estão vinculados a outros romaneios
     * 
     * @param pedidosUnicos - Lista de números de pedidos únicos para verificar
     * @param ciaId - ID da CIA do romaneio atual
     * @param codigoFornecedorSAP - Código do fornecedor SAP do romaneio atual
     * @param documentoHeaderIdAtual - ID do header do documento atual (para excluir da busca)
     * @returns Set com pedidos que já estão vinculados a outros romaneios
     */
    async execute(
        pedidosUnicos: number[],
        ciaId: number,
        codigoFornecedorSAP: string,
        documentoHeaderIdAtual: number
    ): Promise<Set<number>> {
        // Early return: Lista vazia não precisa verificar
        if (pedidosUnicos.length === 0) {
            return new Set<number>();
        }

        log.info(
            `[PedidosDuplicadosCheckerService] Verificando duplicação de ${pedidosUnicos.length} pedidos`
        );

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const pedidosString = pedidosUnicos.map(String);
        const chunks = chunkArray(pedidosString);
        const todosPedidosDuplicados = [];

        log.info(`[PedidosDuplicadosCheckerService] Verificando ${pedidosUnicos.length} pedidos em ${chunks.length} chunk(s)`);

        // PERFORMANCE: Query única com JOIN busca todos os pedidos duplicados de uma vez
        // Busca detalhes que têm pedidos da lista E estão em headers diferentes com mesma CIA/fornecedor
        for (const chunk of chunks) {
            const resultado = await s4DotzClient.documentoFiscalDetalhe.findMany({
                where: {
                    codigoPedidoParceiro: {
                        in: chunk, // Converte para string pois campo é string no banco
                    },
                    documentoFiscalHeader: {
                        id: {
                            not: documentoHeaderIdAtual, // Exclui o documento atual
                        },
                        ciaId: ciaId,
                        codigoFornecedorSAP: codigoFornecedorSAP,
                        tipoDocumentoERP: TipoProcesso.TP_ROM,
                    },
                },
                select: {
                    codigoPedidoParceiro: true,
                },
                distinct: ["codigoPedidoParceiro"],
            });
            todosPedidosDuplicados.push(...resultado);
        }

        // Converte resultado para Set de números para lookup O(1)
        const pedidosSet = new Set<number>();
        for (const detalhe of todosPedidosDuplicados) {
            if (detalhe.codigoPedidoParceiro) {
                const pedidoNumero = Number(detalhe.codigoPedidoParceiro);
                if (!Number.isNaN(pedidoNumero)) {
                    pedidosSet.add(pedidoNumero);
                }
            }
        }

        log.info(
            `[PedidosDuplicadosCheckerService] ${pedidosSet.size} pedidos duplicados encontrados`
        );

        return pedidosSet;
    }
}

