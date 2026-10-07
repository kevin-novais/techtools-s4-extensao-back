import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import type { DetalheParaInserir, DocumentoFiscalData, TotaisRomaneio, TotaisAnalyzer } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

/**
 * Serviço responsável por gerenciar status do documento fiscal durante o processamento
 * 
 * RESPONSABILIDADES:
 * - Buscar e validar documento fiscal
 * - Atualizar status para PROCESSANDO no início
 * - Determinar status final (APROVADO ou DIVERGENCIA)
 * - Atualizar status final ao concluir
 * - Atualizar para ERRO_PROCESSAMENTO em caso de falha
 * 
 * CICLO DE VIDA DO STATUS:
 * 1. PENDENTE → PROCESSANDO (início do processamento)
 * 2. PROCESSANDO → APROVADO (sem divergências) ou DIVERGENCIA (com divergências)
 * 3. Qualquer estado → ERRO_PROCESSAMENTO (em caso de exceção)
 */
export class StatusManagerService {
    /**
     * Busca documento fiscal no banco de dados
     * Usa select para trazer apenas os campos necessários (performance)
     * 
     * @param documentoFiscalHeaderId - ID do documento fiscal
     * @returns Dados do documento necessários para processamento
     * @throws AppError(404) se documento não encontrado
     */
    async buscarDocumento(documentoFiscalHeaderId: number): Promise<DocumentoFiscalData> {
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                id: true,
                ciaId: true,
                codigoDocumento: true,
                codigoFornecedorAnalyzer: true,
                codigoFornecedorSAP: true,
                tipoDocumentoERP: true,
                romaneioUrl: true,
                atualizadoPor: true,
                criadoPor: true,
            },
        });

        // Early return: Se documento não existe, interrompe processamento
        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        return documento;
    }

    /**
     * Atualiza status do documento para PROCESSANDO
     * Marca timestamp de início do processamento para auditoria
     * 
     * @param documentoFiscalHeaderId - ID do documento fiscal
     */
    async atualizarParaProcessando(documentoFiscalHeaderId: number): Promise<void> {
        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoFiscalHeaderId },
            data: {
                status: StatusDocumento.PROCESSANDO,
                dataProcessamentoInicio: new Date(),
            },
        });
        log.info(`[StatusManagerService] Status atualizado para PROCESSANDO`);
    }

    /**
     * Determina status final do documento baseado nas divergências encontradas
     * 
     * REGRA DE NEGÓCIO:
     * - Se ALGUMA linha tem divergência → DIVERGENCIA
     * - Se NENHUMA linha tem divergência → APROVADO
     * 
     * Divergências não impedem conclusão do processamento, apenas mudam o status
     * 
     * @param detalhes - Array de detalhes processados
     * @returns Status final do documento
     */
    determinarStatusFinal(detalhes: DetalheParaInserir[]): string {
        const temDivergencias = detalhes.some((d) => d.divergencias === true);

        if (temDivergencias) {
            return StatusDocumento.DIVERGENCIA;
        }

        return StatusDocumento.APROVADO;
    }

    /**
     * Atualiza status final do documento após processamento bem-sucedido
     * Marca timestamp de fim para auditoria e cálculo de tempo de processamento
     * Salva totais calculados do romaneio (produtos, pedido, frete, combo)
     * Salva totais calculados do Analyzer (produtos, pedido, frete, combo)
     * 
     * @param documentoFiscalHeaderId - ID do documento fiscal
     * @param status - Status final (APROVADO ou DIVERGENCIA)
     * @param totaisRomaneio - Totais calculados do romaneio
     * @param totaisAnalyzer - Totais calculados do Analyzer
     */
    async atualizarStatusFinal(
        documentoFiscalHeaderId: number, 
        status: string,
        totaisRomaneio: TotaisRomaneio,
        totaisAnalyzer: TotaisAnalyzer
    ): Promise<void> {
        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoFiscalHeaderId },
            data: {
                status,
                dataProcessamentoFim: new Date(),
                // Totais do Romaneio (XLSX)
                valorTotalProdutos: totaisRomaneio.valorTotalProdutos,
                valorTotalPedido: totaisRomaneio.valorTotalPedido,
                valorTotalFrete: totaisRomaneio.valorTotalFrete,
                valorTotalCombo: totaisRomaneio.valorTotalCombo,
                quantidadeTotalPedidos: totaisRomaneio.quantidadeTotalPedidos,
                // Totais do Analyzer (Stage)
                valorTotalProdutosAnalyzer: totaisAnalyzer.valorTotalProdutosAnalyzer,
                valorTotalPedidoAnalyzer: totaisAnalyzer.valorTotalPedidoAnalyzer,
                valorTotalFreteAnalyzer: totaisAnalyzer.valorTotalFreteAnalyzer,
                valorTotalComboAnalyzer: totaisAnalyzer.valorTotalComboAnalyzer,
            },
        });

        log.info(`[StatusManagerService] Status final atualizado para ${status} com totais do romaneio e Analyzer calculados`);
    }

    /**
     * Atualiza documento para status de erro quando ocorre exceção no processamento
     * 
     * IMPORTANTE: Não lança exceção se falhar (evita mascarar erro original)
     * Usado no catch do método execute() para marcar documento como falho
     * 
     * @param documentoFiscalHeaderId - ID do documento fiscal
     */
    async atualizarParaErro(documentoFiscalHeaderId: number): Promise<void> {
        try {
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: documentoFiscalHeaderId },
                data: {
                    status: StatusDocumento.ERRO_PROCESSAMENTO,
                    dataProcessamentoFim: new Date(),
                },
            });
            log.info(`[StatusManagerService] Status atualizado para ERRO_PROCESSAMENTO`);
        } catch (error) {
            // Não lança exceção aqui para não mascarar o erro original
            log.error(`[StatusManagerService] Erro ao atualizar status de erro: %o`, error);
        }
    }
}

