import { TipoDocumentoERP } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

/** Campos mínimos para validação de acesso à CIA. */
export const VENDAS_HEADER_ACCESS_SELECT = {
    id: true,
    ciaIdSAP: true,
    status: true,
} as const;

/** Campos retornados na listagem paginada (sem tipo_processo — legado pode ser null). */
export const VENDAS_LIST_SELECT = {
    id: true,
    ciaIdSAP: true,
    status: true,
    tipoCadastro: true,
    codigoClienteAnalyzer: true,
    codigoClienteSAP: true,
    codigoDocumentoERP: true,
    numeroDocumentoAnalyzer: true,
    valorTotalVendas: true,
    dataEmissao: true,
    dataLancamentoContabil: true,
    dataVencimento: true,
    dataIntegracao: true,
    relatorioPdf: true,
    relatorioXlsx: true,
    retornoConsultaBoletoInvent: true,
    dataUltimaConsultaBoleto: true,
    criadoEm: true,
    atualizadoEm: true,
} as const;

/** Campos retornados no detalhe da venda (show / create / update response). */
export const VENDAS_SHOW_SELECT = {
    id: true,
    ciaIdSAP: true,
    status: true,
    tipoCadastro: true,
    codigoClienteAnalyzer: true,
    codigoClienteSAP: true,
    codigoDocumentoERP: true,
    numeroDocumentoAnalyzer: true,
    infoReferenciaAnalyzer: true,
    valorTotalVendas: true,
    pathArquivoFaturaDetalhadaAnalyzer: true,
    pathArquivoRelatorioAnalitico: true,
    dataEmissao: true,
    dataFechamentoDe: true,
    dataFechamentoAte: true,
    dataLancamentoContabil: true,
    dataVencimento: true,
    dataIntegracao: true,
    documentoJson: true,
    retornoIntegracaoSap: true,
    relatorioPdf: true,
    relatorioXlsx: true,
    pathBoleto: true,
    retornoConsultaBoletoInvent: true,
    dataUltimaConsultaBoleto: true,
    dataEnvioEmail: true,
    destinatarioEmail: true,
    retornoEnvioEmail: true,
    criadoEm: true,
    atualizadoEm: true,
} as const;

/** Campos necessários no update para mesclar datas do payload. */
export const VENDAS_UPDATE_LOAD_SELECT = {
    dataEmissao: true,
    dataLancamentoContabil: true,
    dataVencimento: true,
} as const;

/** Valor SAP do tipo de documento (coluna tipo_processo no banco). */
export function resolveVendasTipoDocumentoERP(
    tipo: string | null | undefined,
): string {
    const normalized = tipo?.trim();
    if (normalized) return normalized;

    return TipoDocumentoERP.DR;
}
