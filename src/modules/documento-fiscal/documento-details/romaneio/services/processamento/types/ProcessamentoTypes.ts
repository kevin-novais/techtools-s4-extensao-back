import { Decimal } from "@prisma/client-s4-dotz/runtime/library";

// =============================================================================
// CONFIGURAÇÕES DE PERFORMANCE
// =============================================================================
export const CHUNK_SIZE = 500;
export const PARALLEL_CHUNKS = 4;

// =============================================================================
// TYPES BÁSICOS
// =============================================================================
export type NumericValue = string | number | undefined;
export type NullableNumericValue = string | number | null | undefined;

// =============================================================================
// INTERFACES - PLANILHA
// =============================================================================

/**
 * Representa uma linha do romaneio (planilha XLSX)
 */
export interface RomaneioRow {
    NFVENDA: string | number;
    QTDPROD: NumericValue;
    PRODUTO: string | number;
    DESCRICAO: string;
    VLPROD: NumericValue;
    VLFRETE: NullableNumericValue;
    COMBO: NullableNumericValue;
    VLRPEDIDO: NumericValue;
    PEDIDO_PARCEIRO?: number; /// Opcional para linhas manuais (desconto, reversão, bonificação)
    CHAVE_NFE: string;
}

// =============================================================================
// INTERFACES - DADOS DO Analyzer
// =============================================================================

/**
 * Dados de um pedido do Analyzer com relacionamentos (OPOR → OCRD + POR1 → OITM + POR2)
 */
export interface PedidoAnalyzerData {
    U_DOTZNRPED: number | null;
    CardCode: string | null;
    CANCELED: string | null;
    DocStatus: string | null;
    DocTotal: Decimal | null;
    OCRD: { 
        CardCode: string;
        ativo: boolean | null;
    } | null;
    POR1: Array<{
        DocEntry: number;
        Quantity: Decimal | null;
        U_PRODUTO: string | null;
        ItemCode: string | null;
        LineStatus: string | null;
        U_DocEntryNF: number | null;
        Price: Decimal | null;
        OITM: {
            ItemCode: string;
            Deleted: string | null;
            U_Seidor_PC_Calcula: number | null;
            U_Seidor_PC_Analisa: number | null;
            SuppCatNum: string | null;
        } | null;
    }>;
    POR2: Array<{
        LineTotal: Decimal | null;
        ExpnsCode: number | null;
    }>;
}

// =============================================================================
// INTERFACES - PROCESSAMENTO
// =============================================================================

/**
 * Representa um erro de validação com código identificador
 */
export interface ErrorWithCode {
    code: string;
    message: string;
}

/**
 * Representa um detalhe do documento fiscal pronto para inserção no banco
 */
export interface DetalheParaInserir {
    documentoFiscalHeaderId: number;
    codigoDocumento: string;
    itemDocumento: number;
    codigoFornecedorSAP: string | null;
    codigoProdutoDotz: string | null;
    codigoProdutoFornecedor: string | null;
    codigoProdutoRomaneio: string | null;
    quantidadeProduto: number | null;
    descricaoProduto: string | null;
    valorProduto: number | null;
    valorPedido: number | null;
    valorFrete: number | null;
    valorCombo: number | null;
    codigoPedidoParceiro: string | null;
    codigoPedidoAnalyzer: string | null;
    grupoPisCofins: string | null;
    divergencias: boolean;
    erros: ErrorWithCode[];
    // ID da configuração contábil aplicada
    configuracaoContabilDetalheId?: number | null;
    // Contas contábeis
    contaContabilCreditoCusto?: string | null;
    contaContabilDebitoCusto?: string | null;
    contaContabilCreditoFrete?: string | null;
    contaContabilDebitoFrete?: string | null;
    contaContabilCreditoCombo?: string | null;
    contaContabilDebitoCombo?: string | null;
    contaContabilCreditoPis?: string | null;
    contaContabilDebitoPis?: string | null;
    contaContabilCreditoCofins?: string | null;
    contaContabilDebitoCofins?: string | null;
    contaContabilCreditoValorIs?: string | null;
    contaContabilDebitoValorIs?: string | null;
    contaContabilCreditoValorCbs?: string | null;
    contaContabilDebitoValorCbs?: string | null;
    contaContabilCreditoValorIbsUf?: string | null;
    contaContabilDebitoValorIbsUf?: string | null;
    contaContabilCreditoValorIbsMunicipal?: string | null;
    contaContabilDebitoValorIbsMunicipal?: string | null;
    centroCusto?: string | null;
    centroLucro?: string | null;
    valorPisOperacaoCredor?: number | null;
    valorCofinsOperacaoCredor?: number | null;
}

/**
 * Dados do documento fiscal necessários para processamento
 */
export interface DocumentoFiscalData {
    id: number;
    ciaId: number;
    codigoDocumento: string;
    codigoFornecedorAnalyzer: string;
    codigoFornecedorSAP: string;
    romaneioUrl: string;
    tipoDocumentoERP: string; // string pois vem direto do Prisma
    atualizadoPor: number;
    criadoPor: number;
}

/**
 * Resultado da validação de itens do pedido
 */
export interface ValidacaoItensResult {
    docEntry: string | null;
    divergencias: ErrorWithCode[];
}

/**
 * Totais calculados do romaneio
 */
export interface TotaisRomaneio {
    valorTotalProdutos: Decimal;
    valorTotalPedido: Decimal;
    valorTotalFrete: Decimal;
    valorTotalCombo: Decimal;
    quantidadeTotalPedidos: number;
}

/**
 * Totais calculados do Analyzer (stage)
 */
export interface TotaisAnalyzer {
    valorTotalProdutosAnalyzer: Decimal;
    valorTotalPedidoAnalyzer: Decimal;
    valorTotalFreteAnalyzer: Decimal;
    valorTotalComboAnalyzer: Decimal | null;
}

// =============================================================================
// INTERFACES - CONFIGURAÇÃO CONTÁBIL
// =============================================================================

/**
 * Dados de configuração contábil carregados em memória para lookup O(1)
 */
export interface ConfiguracaoContabilData {
    header: {
        textoHeaderContabil: string | null;
        periodoDeDiferimento: number | null;
        tipoContabilERP: string;
    };
    // Map: "grupoPisCofins|codigoItem" -> configuração específica
    configsPorGrupoEItem: Map<string, ConfigDetalhe>;
    // Map: "grupoPisCofins" -> configuração genérica
    configsGenericasPorGrupo: Map<string, ConfigDetalhe>;
    // Map: codigoItem -> configuração para linhas manuais (validarDivergencia=false)
    configsPorCodigoProdutoManual: Map<string, ConfigDetalhe>;
}

/**
 * Configuração contábil de detalhe (simplificada para uso interno)
 */
export interface ConfigDetalhe {
    id: number;
    grupoPisCofins: string;
    codigoItem: string | null;
    validarDivergencia: boolean;
    aliquotaPis: number | null;
    aliquotaCofins: number | null;
    contaCreditoPis: string | null;
    contaDebitoPis: string | null;
    contaCreditoCofins: string | null;
    contaDebitoCofins: string | null;
    contaCreditoValorProduto: string | null;
    contaDebitoValorProduto: string | null;
    contaCreditoValorFrete: string | null;
    contaDebitoValorFrete: string | null;
    contaCreditoValorCombo: string | null;
    contaDebitoValorCombo: string | null;
    contaCreditoValorIs: string | null;
    contaDebitoValorIs: string | null;
    contaCreditoValorCbs: string | null;
    contaDebitoValorCbs: string | null;
    contaCreditoValorIbsUf: string | null;
    contaDebitoValorIbsUf: string | null;
    contaCreditoValorIbsMunicipal: string | null;
    contaDebitoValorIbsMunicipal: string | null;
    centroCusto: string | null;
    centroLucro: string | null;
}
