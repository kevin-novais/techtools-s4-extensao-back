import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { TipoErro } from "@/@types/DocumentoFiscalError/TipoErroTypes";
import type { DetalheParaInserir } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { getErrorType } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/utils/errorCodes";
import { chunkArray } from "@/util/chunkArray";

/**
 * Serviço responsável por inserir erros/divergências no banco de dados
 * 
 * RESPONSABILIDADES:
 * - Buscar IDs dos detalhes inseridos
 * - Inserir erros associados aos detalhes
 * - Evitar N+1 queries usando WHERE IN e createMany
 * 
 * ESTRATÉGIA ANTI N+1:
 * 1. Filtra apenas detalhes com erros
 * 2. Busca IDs de todos os detalhes em UMA ÚNICA query (WHERE IN)
 * 3. Cria Map para lookup O(1) dos IDs
 * 4. Prepara lista de erros em memória
 * 5. Insere todos os erros em batch (createMany)
 */
export class ErrorPersisterService {
    /**
     * Insere erros/divergências encontradas para os detalhes de um chunk
     * 
     * @param chunk - Array de detalhes com possíveis erros
     */
    async execute(chunk: DetalheParaInserir[]): Promise<void> {
        // Early return: Chunk sem erros, não há nada para inserir
        const detalhesComErros = chunk.filter((d) => d.erros.length > 0);
        if (detalhesComErros.length === 0) {
            return;
        }

        // PERFORMANCE: Busca IDs em UMA ÚNICA query (evita N+1)
        // Usa WHERE IN com lista de itemDocumento
        const documentoFiscalHeaderId = chunk[0].documentoFiscalHeaderId;
        const itensDocumento = detalhesComErros.map((d) => d.itemDocumento);

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const detalhesInseridos = [];
        const chunks = chunkArray(itensDocumento);

        log.info(`[ErrorPersisterService] Buscando IDs de ${itensDocumento.length} detalhes em ${chunks.length} chunk(s)`);

        for (const chunkItem of chunks) {
            const resultado = await s4DotzClient.documentoFiscalDetalhe.findMany({
                where: {
                    documentoFiscalHeaderId,
                    itemDocumento: { in: chunkItem },
                },
                select: {
                    id: true,
                    itemDocumento: true,
                },
            });
            detalhesInseridos.push(...resultado);
        }

        // Cria Map para lookup O(1) (mais rápido que .find() a cada iteração)
        const idsMap = new Map<number, number>();
        for (const detalhe of detalhesInseridos) {
            if (detalhe.itemDocumento !== null) {
                idsMap.set(detalhe.itemDocumento, detalhe.id);
            }
        }

        // Prepara lista de erros para inserção em batch
        const errosParaInserir: Array<{
            documentoFiscalDetalheId: number;
            tipo: TipoErro;
            code: string | null;
            mensagem: string;
        }> = [];

        for (const detalhe of detalhesComErros) {
            const detalheId = idsMap.get(detalhe.itemDocumento);

            if (detalheId) {
                // Um detalhe pode ter múltiplos erros
                for (const erro of detalhe.erros) {
                    errosParaInserir.push({
                        documentoFiscalDetalheId: detalheId,
                        tipo: getErrorType(erro.code) as TipoErro,
                        code: erro.code,
                        mensagem: erro.message,
                    });
                }
            }
        }

        // PERFORMANCE: Insere todos os erros em batch (createMany)
        if (errosParaInserir.length > 0) {
            await s4DotzClient.documentoFiscalErrors.createMany({
                data: errosParaInserir,
            });

            log.info(
                `[ErrorPersisterService] ${errosParaInserir.length} erros inseridos para ${detalhesComErros.length} detalhes`
            );
        }
    }
}

