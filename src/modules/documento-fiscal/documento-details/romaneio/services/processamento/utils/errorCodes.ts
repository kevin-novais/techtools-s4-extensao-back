/**
 * Códigos de Erro de Validação - Documento Fiscal
 * 
 * Este arquivo contém todos os códigos de erro utilizados no processamento
 * de documentos fiscais (romaneios). Cada código representa uma validação
 * específica realizada durante o processamento.
 * 
 * Para mais detalhes sobre as validações, consulte a documentação em:
 * Validações processamento Details.md
 */

export interface ErrorCode {
    code: string;
    descricao: string;
    tabelaAnalyzer: string;
    tipo: "ERRO" | "DIVERGENCIA";
}

export const ERROR_CODES: ErrorCode[] = [
    {
        code: "01",
        descricao: "Pedido com parceiro diferente do parceiro do romaneio",
        tabelaAnalyzer: "opor.CardCode",
        tipo: "ERRO",
    },
    {
        code: "02",
        descricao: "Pedido duplicado no romaneio",
        tabelaAnalyzer: "opor.u_dotznrped",
        tipo: "ERRO",
    },
    {
        code: "03",
        descricao: "Pedido cancelado",
        tabelaAnalyzer: "opor.CANCELED",
        tipo: "ERRO",
    },
    {
        code: "04",
        descricao: "Valor do pedido difere do valor no romaneio",
        tabelaAnalyzer: "opor.DocTotal",
        tipo: "DIVERGENCIA",
    },
    {
        code: "05",
        descricao: "Parceiro não cadastrado na tabela OCRD",
        tabelaAnalyzer: "ocrd.CardCode",
        tipo: "ERRO",
    },
    {
        code: "06",
        descricao: "Parceiro desativado",
        tabelaAnalyzer: "ocrd.ATIVO",
        tipo: "ERRO",
    },
    {
        code: "07",
        descricao: "Detalhe do pedido não encontrado na tabela POR1",
        tabelaAnalyzer: "por1.DocEntry",
        tipo: "ERRO",
    },
    {
        code: "08",
        descricao: "Quantidade no pedido difere da quantidade no romaneio",
        tabelaAnalyzer: "por1.Quantity",
        tipo: "DIVERGENCIA",
    },
    {
        code: "09",
        descricao: "Preço do produto difere do valor no romaneio",
        tabelaAnalyzer: "por1.Price",
        tipo: "DIVERGENCIA",
    },
    {
        code: "10",
        descricao: "Status detalhe do Pedido inválido",
        tabelaAnalyzer: "por1.LineStatus",
        tipo: "ERRO",
    },
    {
        code: "11",
        descricao: "Produto no pedido difere do produto no romaneio",
        tabelaAnalyzer: "por1.U_PRODUTO",
        tipo: "DIVERGENCIA",
    },
    {
        code: "12",
        descricao: "Pedido já foi integrado no ERP (SAP)",
        tabelaAnalyzer: "por1.U_DocEntryNF",
        tipo: "ERRO",
    },
    {
        code: "14",
        descricao: "Valor do frete difere entre romaneio e pedido",
        tabelaAnalyzer: "por2.LineTotal",
        tipo: "DIVERGENCIA",
    },
    {
        code: "15",
        descricao: "Produto não cadastrado na tabela OITM",
        tabelaAnalyzer: "oitm.ItemCode",
        tipo: "ERRO",
    },
    {
        code: "16",
        descricao: "Produto está deletado",
        tabelaAnalyzer: "oitm.Deleted",
        tipo: "ERRO",
    },
    {
        code: "17",
        descricao: "Produto não configurado corretamente",
        tabelaAnalyzer: "oitm.U_Seidor_PC_Calcula",
        tipo: "ERRO",
    },
    {
        code: "18",
        descricao: "Status do pedido inválido (DocStatus diferente de 'O')",
        tabelaAnalyzer: "opor.DocStatus",
        tipo: "ERRO",
    },
    {
        code: "19",
        descricao: "Pedido já vinculado em outro romaneio",
        tabelaAnalyzer: "documento_fiscal_detail.pedido_parceiro",
        tipo: "ERRO",
    },
    {
        code: "20",
        descricao: "Grupo PIS/COFINS não identificado no produto",
        tabelaAnalyzer: "oitm.U_Seidor_PC_Calcula",
        tipo: "ERRO",
    },
    {
        code: "21",
        descricao: "Configuração contábil não encontrada para o grupo PIS/COFINS",
        tabelaAnalyzer: "configuracao_contabil_detail",
        tipo: "ERRO",
    },
];

/**
 * Retorna as informações de um código de erro específico
 * @param code - Código do erro (ex: "01", "02", etc.)
 * @returns Objeto ErrorCode ou undefined se não encontrado
 */
export function getErrorCodeInfo(code: string): ErrorCode | undefined {
    return ERROR_CODES.find((errorCode) => errorCode.code === code);
}

/**
 * Retorna um mapa de códigos de erro para acesso rápido
 * @returns Record com code como chave e ErrorCode como valor
 */
export function getErrorCodesMap(): Record<string, ErrorCode> {
    return ERROR_CODES.reduce((acc, errorCode) => {
        acc[errorCode.code] = errorCode;
        return acc;
    }, {} as Record<string, ErrorCode>);
}

/**
 * Retorna o tipo de um código de erro (ERRO ou DIVERGENCIA)
 * @param code - Código do erro (ex: "01", "02", etc.)
 * @returns Tipo do erro ou "DIVERGENCIA" como fallback
 */
export function getErrorType(code: string): "ERRO" | "DIVERGENCIA" {
    const errorCode = ERROR_CODES.find((ec) => ec.code === code);
    return errorCode?.tipo ?? "DIVERGENCIA";
}
