import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import type { DetalheParaInserir } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { CHUNK_SIZE, PARALLEL_CHUNKS } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { ErrorPersisterService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/persisters/ErrorPersisterService";

/**
 * Serviço responsável por inserir detalhes de documento fiscal no banco de dados
 * 
 * RESPONSABILIDADES:
 * - Dividir detalhes em chunks para otimizar performance
 * - Processar múltiplos chunks em paralelo
 * - Inserir detalhes e seus erros associados
 * - Garantir que todos os chunks sejam processados
 * 
 * ESTRATÉGIA DE PERFORMANCE:
 * - Divide detalhes em chunks de 500 registros
 * - Processa 4 chunks em paralelo (2000 registros por vez)
 * - Usa Promise.allSettled para garantir que todos sejam processados
 * - Se algum chunk falhar, o processamento é interrompido
 * 
 * Por que chunks?
 * - Inserir 10k+ registros de uma vez pode causar timeout ou esgotar memória
 * - Chunks permitem processar grandes volumes de forma incremental
 * - 500 registros é um bom equilíbrio entre throughput e segurança
 * 
 * Por que 4 paralelos?
 * - Aproveita melhor a conexão do banco (reduz tempo de ida/volta)
 * - Não sobrecarrega o banco com muitas conexões simultâneas
 */
export class DetalhePersisterService {
    private readonly errorPersister: ErrorPersisterService;

    constructor() {
        this.errorPersister = new ErrorPersisterService();
    }

    /**
     * Insere detalhes no banco em chunks para otimizar performance e memória
     * 
     * @param detalhes - Array completo de detalhes para inserir
     */
    async execute(detalhes: DetalheParaInserir[]): Promise<void> {
        log.info(
            `[DetalhePersisterService] Inserindo ${detalhes.length} detalhes em chunks de ${CHUNK_SIZE} (${PARALLEL_CHUNKS} paralelos)`
        );

        // Processa em batches de CHUNK_SIZE * PARALLEL_CHUNKS registros
        for (let batchStart = 0; batchStart < detalhes.length; batchStart += CHUNK_SIZE * PARALLEL_CHUNKS) {
            const chunks: DetalheParaInserir[][] = [];

            // Divide batch em chunks para processamento paralelo
            for (let i = 0; i < PARALLEL_CHUNKS; i++) {
                const start = batchStart + i * CHUNK_SIZE;
                if (start >= detalhes.length) break;

                const end = Math.min(start + CHUNK_SIZE, detalhes.length);
                chunks.push(detalhes.slice(start, end));
            }

            // Processa chunks em paralelo
            const chunkPromises = chunks.map((chunk, index) =>
                this.inserirChunk(chunk, batchStart + index * CHUNK_SIZE)
            );

            // Aguarda todos os chunks do batch (falha se algum falhar)
            const results = await Promise.allSettled(chunkPromises);

            // Verifica se algum chunk falhou
            for (const result of results) {
                if (result.status === "rejected") {
                    log.error(`[DetalhePersisterService] Falha ao inserir chunk: %o`, result.reason);
                    throw new Error(`Falha ao inserir chunk: ${result.reason}`);
                }
            }

            log.info(
                `[DetalhePersisterService] Batch ${batchStart + 1}-${Math.min(batchStart + CHUNK_SIZE * PARALLEL_CHUNKS, detalhes.length)} inserido`
            );
        }

        log.info(`[DetalhePersisterService] Todos os detalhes foram inseridos com sucesso`);
    }

    /**
     * Insere um chunk de detalhes no banco
     * 
     * FLUXO:
     * 1. Remove campo 'erros' (não existe na tabela DocumentoFiscalDetalhe)
     * 2. Insere detalhes em batch (createMany)
     * 3. Delega inserção de erros para ErrorPersisterService
     * 
     * @param chunk - Array de detalhes do chunk
     * @param startIndex - Índice inicial do chunk (para log)
     */
    private async inserirChunk(chunk: DetalheParaInserir[], startIndex: number): Promise<void> {
        // Remove campo 'erros' que não existe na tabela (será inserido em DocumentoFiscalErrors)
        const detalhesParaInserir = chunk.map(({ erros, ...resto }) => resto);

        // PERFORMANCE: createMany insere múltiplos registros em uma única operação
        await s4DotzClient.documentoFiscalDetalhe.createMany({
            data: detalhesParaInserir,
        });

        log.info(
            `[DetalhePersisterService] Chunk ${startIndex + 1}-${startIndex + chunk.length} inserido (${chunk.length} registros)`
        );

        // Insere erros associados aos detalhes recém-criados
        await this.errorPersister.execute(chunk);
    }
}

