import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { PosToDetalheMapperService } from "@/modules/documento-fiscal/documento-details/pos/services/processamento/mappers/PosToDetalheMapperService";
import type { ProcessPosParams } from "@/modules/documento-fiscal/documento-details/pos/services/processamento/types/ProcessamentoPosTypes";
import { ConfiguracaoContabilFetcherService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/fetchers/ConfiguracaoContabilFetcherService";
import { ErrorPersisterService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/persisters/ErrorPersisterService";
import { IntegrationOrchestratorService } from "@/modules/documento-fiscal/utils/integracao/IntegrationOrchestratorService";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { PosRawQueryRepository } from "./PosRawQueryRepository";

export class ProcessDocumentoFiscalPosDetalheService {
    private readonly CHUNK_SIZE = 1000; // Processar 1000 linhas por vez
    private readonly BATCH_INSERT_SIZE = 500; // Inserir 500 registros por batch
    private readonly PARALLEL_INSERTS = 2; // Processar 2 batches em paralelo

    private readonly posToDetalheMapper: PosToDetalheMapperService;
    private readonly configContabilFetcher: ConfiguracaoContabilFetcherService;
    private readonly errorPersister: ErrorPersisterService;
    private readonly integrationOrchestrator: IntegrationOrchestratorService;
    private readonly posRawQueryRepository: PosRawQueryRepository;

    constructor() {
        this.posToDetalheMapper = new PosToDetalheMapperService();
        this.configContabilFetcher = new ConfiguracaoContabilFetcherService();
        this.errorPersister = new ErrorPersisterService();
        this.integrationOrchestrator = new IntegrationOrchestratorService();
        this.posRawQueryRepository = new PosRawQueryRepository();
    }

    /**
     * Processa documento fiscal POS, gerando detalhes a partir das linhas POR1 filtradas
     * 
     * FLUXO:
     * 1. Busca documento header
     * 2. Atualiza status para PROCESSANDO
     * 3. Carrega configuração contábil
     * 4. Loop de chunks:
     *    - Busca linhas POS do fornecedor específico
     *    - Mapeia para DetalheParaInserir (aplicando config contábil)
     *    - Insere em batches
     * 5. Calcula e atualiza totais no header
     * 6. Atualiza status final
     */
    async execute(params: ProcessPosParams): Promise<void> {
        const { documentoFiscalHeaderId, filtros } = params;

        log.info(`[ProcessPosDetalhe] Iniciando processamento documento ${documentoFiscalHeaderId}`);

        const documento = await this.fetchDocumento(documentoFiscalHeaderId);

        if (!documento) {
            throw new AppError(`Documento fiscal não encontrado ${documentoFiscalHeaderId}.`, 404);
        }

        // Atualizar status para PROCESSANDO;
        await this.updateStatus(documentoFiscalHeaderId, StatusDocumento.PROCESSANDO, new Date());

        try {
            // Buscar configuração contábil para aplicar aos detalhes
            const configContabil = await this.configContabilFetcher.execute(
                documento.ciaId,
                documento.tipoDocumentoERP
            );


            // Processar em chunks
            let processados = 0;
            let totalInseridos = 0;
            let itemSequence = 1;

            while (true) {
                const linhas = await this.posRawQueryRepository.findManyDetails(filtros, 0, this.CHUNK_SIZE);

                if (linhas.length === 0) {
                    if (processados === 0) {
                        log.warn(`[ProcessPosDetalhe] Nenhuma linha encontrada com os filtros aplicados`);
                        await this.updateStatus(
                            documentoFiscalHeaderId,
                            StatusDocumento.PROCESSADO,
                            undefined,
                            new Date()
                        );
                        return;
                    }
                    break;
                }
                

                // Mapear para detalhes (aplicando configuração contábil e verificando duplicação)
                const detalhes = this.posToDetalheMapper.mapLinhas(
                    linhas,
                    documento,
                    itemSequence,
                    configContabil,
                );

                // Verificar duplicação e inserir apenas os novos
                const resultado = await this.insertDetalhes(detalhes);
                totalInseridos += resultado.inseridos;
                processados += linhas.length;
                itemSequence += linhas.length;

                log.info(`[ProcessPosDetalhe] Processados ${processados} linhas (${resultado.inseridos} inseridos)`);
            }

            // Calcular totais e atualizar header
            await this.updateHeaderTotals(documentoFiscalHeaderId);

            // Atualizar status final
            await this.updateStatus(
                documentoFiscalHeaderId,
                StatusDocumento.APROVADO,
                undefined,
                new Date()
            );

            log.info(`[ProcessPosDetalhe] Documento ${documentoFiscalHeaderId} processado com sucesso - ${totalInseridos} linhas inseridas`);

            // Verificar se há itens ainda não integrados com o SAP
            const itensParaIntegrar = await s4DotzClient.documentoFiscalDetalhe.count({
                where: { documentoFiscalHeaderId, codigoDocumentoERP: null },
            });

            if (itensParaIntegrar === 0) {
                // Todos os itens já possuem Doc. SAP (U_DocEntryNF extraído do Stage)
                await this.updateStatus(documentoFiscalHeaderId, StatusDocumento.PROCESSADO, undefined, new Date());
                log.info(`[ProcessPosDetalhe] Documento ${documentoFiscalHeaderId} marcado como PROCESSADO — todos os itens já integrados no SAP`);
                return;
            }

            // Enfileirar para integração SAP (documento aprovado)
            const usuarioId = documento.atualizadoPor || documento.criadoPor;
            await this.integrationOrchestrator.enqueue({
                documentoFiscalHeaderId,
                usuarioId,
                origem: "POS",
            });

            log.info(`[ProcessPosDetalhe] Documento ${documentoFiscalHeaderId} enfileirado para integração SAP (${itensParaIntegrar} item(ns) sem Doc. SAP)`);

        } catch (error) {
            log.error(`[ProcessPosDetalhe] Erro ao processar documento ${documentoFiscalHeaderId}: %o`, error);

            await this.updateStatus(
                documentoFiscalHeaderId,
                StatusDocumento.ERRO_PROCESSAMENTO,
                undefined,
                new Date()
            );

            throw error;
        }
    }

    private async fetchDocumento(id: number) {
        return s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id },
            select: {
                id: true,
                ciaId: true,
                codigoDocumento: true,
                codigoFornecedorSAP: true,
                codigoFornecedorAnalyzer: true,
                tipoDocumentoERP: true,
                atualizadoPor: true,
                criadoPor: true,
            },
        });
    }

    private async insertDetalhes(detalhes: any[]): Promise<{ inseridos: number;}> {

        // Inserir em batches com paralelismo configurável
        for (let batchStart = 0; batchStart < detalhes.length; batchStart += this.BATCH_INSERT_SIZE * this.PARALLEL_INSERTS) {
            const parallelBatches: any[][] = [];

            // Divide em batches para processamento paralelo
            for (let i = 0; i < this.PARALLEL_INSERTS; i++) {
                const start = batchStart + i * this.BATCH_INSERT_SIZE;
                if (start >= detalhes.length) break;

                const end = Math.min(start + this.BATCH_INSERT_SIZE, detalhes.length);
                parallelBatches.push(detalhes.slice(start, end));
            }

            // Processa batches em paralelo
            const insertPromises = parallelBatches.map((batch, index) =>
                this.insertBatch(batch, batchStart + index * this.BATCH_INSERT_SIZE)
            );

            // Aguarda todos os batches do grupo
            const results = await Promise.allSettled(insertPromises);

            // Verifica se algum batch falhou
            for (const result of results) {
                if (result.status === "rejected") {
                    log.error(`[ProcessPosDetalhe] Falha ao inserir batch: %o`, result.reason);
                    throw new Error(`Falha ao inserir batch: ${result.reason}`);
                }
            }

            log.info(
                `[ProcessPosDetalhe] Batch ${batchStart + 1}-${Math.min(batchStart + this.BATCH_INSERT_SIZE * this.PARALLEL_INSERTS, detalhes.length)} inserido`
            );
        }

        return { inseridos: detalhes.length };
    }

    private async insertBatch(batch: any[], startIndex: number): Promise<void> {
        // Remove campo 'erros' que não existe na tabela DocumentoFiscalDetalhe
        const detalhesParaInserir = batch.map(({ erros, ...resto }) => resto);

        await s4DotzClient.documentoFiscalDetalhe.createMany({
            data: detalhesParaInserir,
        });

        log.info(
            `[ProcessPosDetalhe] Batch ${startIndex + 1}-${startIndex + batch.length} inserido (${batch.length} registros)`
        );

        // Persistir erros/divergências associados aos detalhes inseridos
        await this.errorPersister.execute(batch);
    }

    private async updateStatus(
        headerId: number,
        status: string,
        dataInicio?: Date,
        dataFim?: Date
    ): Promise<void> {
        const updateData: any = { status };

        if (dataInicio) {
            updateData.dataProcessamentoInicio = dataInicio;
        }

        if (dataFim) {
            updateData.dataProcessamentoFim = dataFim;
        }

        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: headerId },
            data: updateData,
        });
    }

    private async updateHeaderTotals(headerId: number): Promise<void> {
        // Calcular totais agregando os detalhes já inseridos
        const totals = await s4DotzClient.documentoFiscalDetalhe.aggregate({
            where: {
                documentoFiscalHeaderId: headerId,
            },
            _sum: {
                valorProduto: true,
                valorPedido: true,
                valorFrete: true,
                valorCombo: true,
            },
            _count: {
                id: true,
            },
        });

        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: headerId },
            data: {
                quantidadeTotalPedidos: totals._count.id,
                valorTotalProdutos: totals._sum.valorProduto || 0,
                valorTotalPedido: totals._sum.valorPedido || 0,
                valorTotalFrete: totals._sum.valorFrete || 0,
                valorTotalCombo: totals._sum.valorCombo || 0,
            },
        });

        log.info(`[ProcessPosDetalhe] Totais atualizados no header ${headerId}`);
    }
}

