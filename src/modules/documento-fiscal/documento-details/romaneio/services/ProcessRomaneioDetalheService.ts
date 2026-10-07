import log from "@/util/logger";
import type { DetalheParaInserir, PedidoAnalyzerData, RomaneioRow, ErrorWithCode, ConfiguracaoContabilData } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { parseToDecimal } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/utils/DecimalParser";
import { PlanilhaReaderService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/readers/PlanilhaReaderService";
import { AnalyzerDataFetcherService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/fetchers/AnalyzerDataFetcherService";
import { ConfiguracaoContabilFetcherService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/fetchers/ConfiguracaoContabilFetcherService";
import { StatusManagerService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/managers/StatusManagerService";
import { DetalhePersisterService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/persisters/DetalhePersisterService";
import { PedidoAnalyzerValidator } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/PedidoAnalyzerValidator";
import { ItensPedidoValidator } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/validators/ItensPedidoValidator";
import { TotaisRomaneioCalculator } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/calculators/TotaisRomaneioCalculator";
import { TotaisAnalyzerCalculator } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/calculators/TotaisAnalyzerCalculator";
import { PedidosDuplicadosCheckerService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/checkers/PedidosDuplicadosCheckerService";
import { ConfiguracaoContabilApplicatorService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/applicators/ConfiguracaoContabilApplicatorService";
import { IntegrationOrchestratorService } from "@/modules/documento-fiscal/utils/integracao/IntegrationOrchestratorService";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { filtrarLinhasPorDocumento } from "@/modules/documento-fiscal/utils/codigosDocumentoRomaneio";
import AppError from "@/util/AppError";

export class ProcessRomaneioDetalheService {
    private readonly planilhaReader: PlanilhaReaderService;
    private readonly AnalyzerFetcher: AnalyzerDataFetcherService;
    private readonly statusManager: StatusManagerService;
    private readonly detalhePersister: DetalhePersisterService;
    private readonly pedidoValidator: PedidoAnalyzerValidator;
    private readonly itensValidator: ItensPedidoValidator;
    private readonly totaisCalculator: TotaisRomaneioCalculator;
    private readonly totaisAnalyzerCalculator: TotaisAnalyzerCalculator;
    private readonly pedidosDuplicadosChecker: PedidosDuplicadosCheckerService;
    private readonly configContabilFetcher: ConfiguracaoContabilFetcherService;
    private readonly configContabilApplicator: ConfiguracaoContabilApplicatorService;
    private readonly integrationOrchestrator: IntegrationOrchestratorService;

    constructor() {
        this.planilhaReader = new PlanilhaReaderService();
        this.AnalyzerFetcher = new AnalyzerDataFetcherService();
        this.statusManager = new StatusManagerService();
        this.detalhePersister = new DetalhePersisterService();
        this.pedidoValidator = new PedidoAnalyzerValidator();
        this.itensValidator = new ItensPedidoValidator();
        this.totaisCalculator = new TotaisRomaneioCalculator();
        this.totaisAnalyzerCalculator = new TotaisAnalyzerCalculator();
        this.pedidosDuplicadosChecker = new PedidosDuplicadosCheckerService();
        this.configContabilFetcher = new ConfiguracaoContabilFetcherService();
        this.configContabilApplicator = new ConfiguracaoContabilApplicatorService();
        this.integrationOrchestrator = new IntegrationOrchestratorService();
    }

    /**
     * Processa um documento fiscal (romaneio), validando cada linha contra pedidos do Analyzer
     * e gerando registros de detalhe com suas respectivas divergências.
     * 
     * FLUXO GERAL:
     * 1. Setup e Inicialização - Busca documento e atualiza status para PROCESSANDO
     * 2. Leitura de Dados - Lê planilha XLSX e busca pedidos do Analyzer com JOINs
     * 3. Validação e Processamento - Valida cada linha contra regras de negócio
     * 4. Persistência - Insere detalhes e erros em chunks paralelos
     * 5. Finalização - Define status final (APROVADO ou DIVERGENCIA)
     */
    async execute(documentoFiscalHeaderId: number): Promise<void> {
        log.info(
            `[ProcessDocumentoFiscalDetalheService] Iniciando processamento do documento ${documentoFiscalHeaderId}`
        );

        try {
            // =========================================================================
            // FASE 1: SETUP E INICIALIZAÇÃO
            // =========================================================================
            const documento = await this.statusManager.buscarDocumento(documentoFiscalHeaderId);
            await this.statusManager.atualizarParaProcessando(documentoFiscalHeaderId);

            // =========================================================================
            // FASE 2: LEITURA DE DADOS
            // =========================================================================
            // Lê a planilha e mantém apenas as linhas deste documento: um mesmo
            // arquivo pode conter vários documentos (um header por código/NFVENDA)
            const todasAsLinhas = await this.planilhaReader.execute(documento.romaneioUrl);
            const rows = filtrarLinhasPorDocumento(todasAsLinhas, documento.codigoDocumento);

            log.info(
                `[ProcessDocumentoFiscalDetalheService] Documento ${documento.codigoDocumento}: ${rows.length} de ${todasAsLinhas.length} linha(s) do arquivo`
            );

            if (rows.length === 0) {
                throw new AppError(
                    `Nenhuma linha encontrada para o documento ${documento.codigoDocumento} no arquivo do romaneio`,
                    400
                );
            }

            // Calcula totais do romaneio para salvar no header
            const totais = {
                ...this.totaisCalculator.calcular(rows),
                quantidadeTotalPedidos: rows.length,
            };

            // Valida se há pedidos duplicados no romaneio
            const divergenciasDuplicacao = this.planilhaReader.validarDuplicacoes(rows);
            if (divergenciasDuplicacao.length > 0) {
                log.warn(
                    `[ProcessDocumentoFiscalDetalheService] ${divergenciasDuplicacao.length} divergências de duplicação encontradas`
                );
            }

            // Extrai lista de pedidos únicos para otimizar busca no Analyzer
            const pedidosUnicos = this.planilhaReader.extrairPedidosUnicos(rows);

            // Busca todos os pedidos do Analyzer em UMA ÚNICA query com JOINs (OPOR → OCRD + POR1 → OITM + POR2)
            // Isso evita N+1 queries e melhora drasticamente a performance
            const pedidosAnalyzer = await this.AnalyzerFetcher.execute(pedidosUnicos);

            // Calcula totais do Analyzer (stage) usando os dados já buscados
            const totaisAnalyzer = this.totaisAnalyzerCalculator.execute(pedidosAnalyzer);

            // Verifica se algum dos pedidos já está vinculado a outro romaneio
            // Query única retorna Set para lookup O(1) durante validação
            const pedidosDuplicados = await this.pedidosDuplicadosChecker.execute(
                pedidosUnicos,
                documento.ciaId,
                documento.codigoFornecedorAnalyzer,
                documentoFiscalHeaderId
            );

            // Busca configurações contábeis para aplicar aos detalhes
            // Query única com include traz todos os detalhes (evita N+1)
            const configContabil = await this.configContabilFetcher.execute(
                documento.ciaId,
                documento.tipoDocumentoERP
            );

            // =========================================================================
            // FASE 3: VALIDAÇÃO E PROCESSAMENTO
            // =========================================================================
            // Processa cada linha da planilha, aplicando todas as validações
            // Divergências são coletadas mas não bloqueiam o processamento
            const detalhesParaInserir = this.validarEProcessarLinhas(
                rows,
                pedidosAnalyzer,
                pedidosDuplicados,
                configContabil,
                documentoFiscalHeaderId,
                documento.codigoDocumento,
                documento.codigoFornecedorSAP
            );

            // =========================================================================
            // FASE 4: PERSISTÊNCIA
            // =========================================================================
            // Insere detalhes em chunks para otimizar performance e memória
            await this.detalhePersister.execute(detalhesParaInserir);

            // =========================================================================
            // FASE 5: FINALIZAÇÃO
            // =========================================================================
            // Define status final baseado na presença de divergências
            const statusFinal = this.statusManager.determinarStatusFinal(detalhesParaInserir);
            await this.statusManager.atualizarStatusFinal(documentoFiscalHeaderId, statusFinal, totais, totaisAnalyzer);

            log.info(
                `[ProcessDocumentoFiscalDetalheService] Processamento concluído para documento ${documentoFiscalHeaderId} com status ${statusFinal}`
            );

            // =========================================================================
            // FASE 6: ENFILEIRAR INTEGRAÇÃO SAP (APENAS SE APROVADO)
            // =========================================================================
            // Apenas documentos APROVADOS (sem divergências) devem ser integrados com SAP
            if (statusFinal === StatusDocumento.APROVADO) {
                const usuarioId = documento.atualizadoPor || documento.criadoPor;
                await this.integrationOrchestrator.enqueue({
                    documentoFiscalHeaderId,
                    usuarioId,
                    origem: "ROM",
                });
                log.info(
                    `[ProcessDocumentoFiscalDetalheService] Documento ${documentoFiscalHeaderId} enfileirado para integração SAP`
                );
            }
        } catch (error) {
            // FLUXO DE ERRO: Qualquer exceção marca documento como ERRO_PROCESSAMENTO
            // Isso permite retry manual posterior ou investigação do problema
            log.error(
                `[ProcessDocumentoFiscalDetalheService] Erro ao processar documento ${documentoFiscalHeaderId}: %o`,
                error
            );
            await this.statusManager.atualizarParaErro(documentoFiscalHeaderId);
            throw error;
        }
    }

    // =========================================================================
    // FASE 3: VALIDAÇÃO E PROCESSAMENTO
    // =========================================================================

    /**
     * Processa todas as linhas da planilha, aplicando validações de negócio
     * 
     * IMPORTANTE: Divergências não são bloqueantes, o processamento continua
     * e todas as divergências são coletadas para posterior análise
     */
    private validarEProcessarLinhas(
        rows: RomaneioRow[],
        pedidosAnalyzer: Map<number, PedidoAnalyzerData>,
        pedidosDuplicados: Set<number>,
        configContabil: ConfiguracaoContabilData,
        documentoFiscalHeaderId: number,
        codigoDocumento: string,
        codigoFornecedorSAPHeader: string
    ): DetalheParaInserir[] {
        log.info(`[ProcessDocumentoFiscalDetalheService] Validando e processando ${rows.length} linhas`);

        const detalhes: DetalheParaInserir[] = [];
        let itemSequencial = 1;

        // Contexto do documento para passar aos métodos de processamento
        const contextoDocumento = {
            documentoFiscalHeaderId,
            codigoDocumento,
            codigoFornecedorSAPHeader,
        };

        // Processa cada linha sequencialmente aplicando todas as validações
        for (const row of rows) {
            const detalhe = this.processarLinha(
                row,
                pedidosAnalyzer,
                pedidosDuplicados,
                configContabil,
                contextoDocumento,
                itemSequencial++
            );
            detalhes.push(detalhe);
        }

        const totalComDivergencias = detalhes.filter((d) => d.divergencias === true).length;
        log.info(`[ProcessDocumentoFiscalDetalheService] Validação concluída: ${totalComDivergencias} linhas com divergências`);

        return detalhes;
    }

    /**
     * Processa uma linha da planilha, aplicando todas as validações
     * 
     * FLUXO DE VALIDAÇÃO:
     * 1. Verifica se pedido existe no Analyzer
     * 2. Se existe, valida dados do pedido usando PedidoAnalyzerValidator
     * 3. Valida itens do pedido usando ItensPedidoValidator
     * 4. Aplica configuração contábil ao detalhe
     * 
     * Todas as divergências são coletadas no array 'divergencias'
     * Linha é processada mesmo com divergências (não bloqueante)
     */
    private processarLinha(
        row: RomaneioRow,
        pedidosAnalyzer: Map<number, PedidoAnalyzerData>,
        pedidosDuplicados: Set<number>,
        configContabil: ConfiguracaoContabilData,
        contextoDocumento: {
            documentoFiscalHeaderId: number;
            codigoDocumento: string;
            codigoFornecedorSAPHeader: string;
        },
        itemSequencial: number
    ): DetalheParaInserir {
        const codigoProdutoRomaneio = String(row.PRODUTO).trim();
        const configManual = configContabil.configsPorCodigoProdutoManual.get(codigoProdutoRomaneio);

        // Linha manual: config existe para o código do produto (validarDivergencia=false).
        // O valor do romaneio é indiferente: bonificação/desconto chegam com VLRPEDIDO negativo.
        if (configManual) {
            return this.processarLinhaManual(
                row,
                configContabil,
                contextoDocumento,
                itemSequencial,
                codigoProdutoRomaneio
            );
        }

        const divergencias: ErrorWithCode[] = [];
        const pedidoParceiro = Number(row.PEDIDO_PARCEIRO ?? Number.NaN);
        const pedidoAnalyzer = pedidosAnalyzer.get(pedidoParceiro);

        let docEntry: string | null = null;
        let codigoProdutoDotz: string | null = null;
        let codigoProdutoFornecedor: string | null = null;
        let grupoPisCofins: string | null = null;
        let codigoFornecedorSAP: string | null = null;

        // VALIDAÇÃO 1: Pedido existe no Analyzer?
        if (pedidoAnalyzer) {
            // Captura o código do fornecedor SAP do pedido
            codigoFornecedorSAP = pedidoAnalyzer.CardCode;

            // VALIDAÇÃO 2: Dados do pedido estão corretos?
            const divergenciasPedido = this.pedidoValidator.validar(
                pedidoAnalyzer,
                pedidoParceiro,
                contextoDocumento.codigoFornecedorSAPHeader,
                row
            );
            divergencias.push(...divergenciasPedido);

            // VALIDAÇÃO 3: Itens do pedido estão corretos?
            const resultadoItens = this.itensValidator.validar(pedidoAnalyzer, pedidoParceiro, row);
            docEntry = resultadoItens.docEntry;
            divergencias.push(...resultadoItens.divergencias);

            // EXTRAÇÃO DE DADOS: Usa o primeiro item do pedido para extrair dados fiscais
            const por1Item = pedidoAnalyzer.POR1[0];
            if (por1Item?.OITM) {
                codigoProdutoDotz = por1Item.OITM.ItemCode;
                codigoProdutoFornecedor = por1Item.OITM.SuppCatNum;

                // Converte U_Seidor_PC_Calcula (1=S, 2=N) para formato esperado
                switch (por1Item.OITM.U_Seidor_PC_Calcula) {
                    case 1:
                        grupoPisCofins = "S";
                        break;
                    case 2:
                        grupoPisCofins = "N";
                        break;
                }
            }
        } else {
            divergencias.push({
                code: "00",
                message: `Pedido '${pedidoParceiro}' não encontrado no Analyzer`,
            });
        }

        // VALIDAÇÃO ADICIONAL: Pedido já vinculado em outro romaneio? (ignora NaN)
        if (!Number.isNaN(pedidoParceiro) && pedidosDuplicados.has(pedidoParceiro)) {
            divergencias.push({
                code: "19",
                message: `Pedido '${pedidoParceiro}' já vinculado em outro romaneio`,
            });
        }

        // Monta objeto de detalhe com dados da linha e divergências encontradas
        const detalhe: DetalheParaInserir = {
            documentoFiscalHeaderId: contextoDocumento.documentoFiscalHeaderId,
            codigoDocumento: contextoDocumento.codigoDocumento,
            itemDocumento: itemSequencial,
            codigoFornecedorSAP,
            codigoProdutoDotz,
            codigoProdutoFornecedor,
            codigoProdutoRomaneio,
            quantidadeProduto: row.QTDPROD ? Number(String(row.QTDPROD).replace(",", ".")) : null,
            descricaoProduto: row.DESCRICAO || null,
            valorProduto: parseToDecimal(row.VLPROD)?.toNumber() ?? null,
            valorPedido: parseToDecimal(row.VLRPEDIDO)?.toNumber() ?? null,
            valorFrete: parseToDecimal(row.VLFRETE)?.toNumber() ?? null,
            valorCombo: parseToDecimal(row.COMBO)?.toNumber() ?? null,
            codigoPedidoParceiro: Number.isNaN(pedidoParceiro) ? null : String(pedidoParceiro),
            codigoPedidoAnalyzer: docEntry,
            grupoPisCofins,
            divergencias: divergencias.length > 0,
            erros: divergencias,
        };

        // VALIDAÇÃO 4: Aplica configuração contábil ao detalhe
        const resultadoConfig = this.configContabilApplicator.execute(detalhe, configContabil);

        // Salva o ID da configuração contábil aplicada
        detalhe.configuracaoContabilDetalheId = resultadoConfig.configuracaoContabilDetalheId;

        // Adiciona divergências de configuração contábil (se houver)
        if (resultadoConfig.divergencias.length > 0) {
            detalhe.erros.push(...resultadoConfig.divergencias);
            detalhe.divergencias = true;
        }

        return detalhe;
    }

    /**
     * Processa linha manual (desconto, reversão, bonificação)
     * Não valida pedido/produto; usa config contábil por codigoProdutoRomaneio; divergencias = false
     */
    private processarLinhaManual(
        row: RomaneioRow,
        configContabil: ConfiguracaoContabilData,
        contextoDocumento: {
            documentoFiscalHeaderId: number;
            codigoDocumento: string;
            codigoFornecedorSAPHeader: string;
        },
        itemSequencial: number,
        codigoProdutoRomaneio: string
    ): DetalheParaInserir {
        const detalhe: DetalheParaInserir = {
            documentoFiscalHeaderId: contextoDocumento.documentoFiscalHeaderId,
            codigoDocumento: contextoDocumento.codigoDocumento,
            itemDocumento: itemSequencial,
            codigoFornecedorSAP: contextoDocumento.codigoFornecedorSAPHeader,
            codigoProdutoDotz: null,
            codigoProdutoFornecedor: null,
            codigoProdutoRomaneio,
            quantidadeProduto: row.QTDPROD ? Number(String(row.QTDPROD).replace(",", ".")) : null,
            descricaoProduto: row.DESCRICAO || null,
            valorProduto: parseToDecimal(row.VLPROD)?.toNumber() ?? null,
            valorPedido: null,
            valorFrete: parseToDecimal(row.VLFRETE)?.toNumber() ?? null,
            valorCombo: parseToDecimal(row.COMBO)?.toNumber() ?? null,
            codigoPedidoParceiro: null,
            codigoPedidoAnalyzer: null,
            grupoPisCofins: null,
            divergencias: false,
            erros: [],
        };

        const resultadoConfig = this.configContabilApplicator.execute(detalhe, configContabil, {
            isLinhaManual: true,
        });

        detalhe.configuracaoContabilDetalheId = resultadoConfig.configuracaoContabilDetalheId;

        if (resultadoConfig.divergencias.length > 0) {
            detalhe.erros.push(...resultadoConfig.divergencias);
            detalhe.divergencias = true;
        }

        return detalhe;
    }
}

