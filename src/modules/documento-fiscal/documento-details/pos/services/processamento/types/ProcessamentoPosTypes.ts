export interface ProcessPosParams {
    documentoFiscalHeaderId: number;
    filtros: {
        dataEmissaoDe?: string;
        dataEmissaoAte?: string;
        dataVencimentoDe?: string;
        dataVencimentoAte?: string;
        codigoFornecedorDe?: string;
        codigoFornecedorAte?: string;
        segmento?: string;
    };
    fornecedorCardCode?: string; // Agora opcional - quando não informado, processa todos do grupo
}

export interface FornecedorInfo {
    cardCode: string;
    cardName: string;
    codigoDotz: number;
    totalPedidos: number;
}

export interface ErrorWithCode {
    code: string;
    message: string;
}

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
    codigoDocumentoERP?: string | null;
    grupoPisCofins: string | null;
    divergencias: boolean;
    erros: ErrorWithCode[];
    configuracaoContabilDetalheId?: number | null;
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
    valorPisOperacaoCredor?: number | null;
    valorCofinsOperacaoCredor?: number | null;
}

export interface PosLinhaData {
    DocEntry: number;
    LineNum: number;
    ItemCode: string | null;
    Dscription: string | null;
    Quantity: any;
    Price: any;
    LineTotal: any;
    LineStatus: string | null;
    U_POS_ID: number | null;
    U_DocEntryNF: bigint | null;
    OPOR: {
        CardCode: string | null;
        DocEntry: number;
        DocStatus: string | null;
        U_DOTZNRPED: number | null;
        U_DATA_ORIGEM_PEDIDO: Date | null;
        DocDueDate: Date | null;
    };
    OITM: {
        ItemCode: string;
        SuppCatNum: string | null;
        U_Seidor_PC_Calcula: number | null;
    } | null;
}

