/**
 * Tipos do fluxo de SAÍDA XTPG (DeepXRT -> LCM no S/4).
 *
 * Fluxo: ler movimentos contábeis pendentes no XTPG (Saida.asmx –
 * ListarMovimentosContabeisPeloStatus), agrupar por PAR_CONTABIL, criar o
 * lançamento contábil (Journal Entry) no S/4 e devolver o status ao XTPG
 * (MudarStatusMovimentoParContabil, com o nº do LCM na "critica").
 *
 * Ver especificação consolidada: DTZ-227_Saida_XTPG_LCM_S4.md
 */

/**
 * Movimento contábil retornado por `ListarMovimentosContabeisPeloStatus`.
 * Campos espelham o contrato SOAP legado
 * (XrtServImporterConsole / ListarMovimentosContabeisPeloStatusResponseContabil).
 * Só estão tipados aqui os campos efetivamente usados na montagem do LCM; os
 * FlexField1..30 e demais ficam acessíveis via `extras`.
 */
export interface MovimentoContabilXtpg {
    /** PFJ_CODIGO – empresa de origem (de-para -> CompanyCode no S/4, via tabela `cia`). */
    pfjCodigo: string;
    /** PAR_CONTABIL – agrupador do lote (1 LCM por PAR_CONTABIL). */
    parContabil: string;
    /** DATA – vira PostingDate e DocumentDate. */
    data: string;
    /** IND_CODIGO – moeda de origem (BRL fixo, mas gravada no Detail). */
    indCodigo: string;
    /** Conta do razão COMPLETA (GLAccount) – lida de FlexField12 (a tag <ContaContabil>
     *  traz só os 4 últimos dígitos; o dígito curto fica em extras.ContaContabilCurta). */
    contaContabil: string;
    /** CREDITO_DEBITO – 'D' ou 'C'. Dita o sinal do valor (não há campo S/H). */
    creditoDebito: string;
    /** VALOR – valor do movimento (sinal aplicado conforme D/C). */
    valor: string;
    /** LOTE – texto do cabeçalho do LCM. */
    lote: string;
    /** HISTORICO – texto de detalhe (por linha). */
    historico: string;
    /** Dados bancários de origem (de-para -> House Bank / House Bank Account). */
    banCodigo: string;
    ageCodigo: string;
    cntCodigo: string;
    /** Identificador do movimento (rastreio). */
    mvtContador: string;
    /** Demais campos do contrato (FlexField1..30, Tipo, ApropriacaoCaixa, etc.). */
    extras: Record<string, string>;
}

/** Movimentos de um mesmo PAR_CONTABIL – origem de 1 LCM. */
export interface LoteParContabil {
    parContabil: string;
    pfjCodigo: string;
    /** DATA do cabeçalho (igual para todas as linhas do PAR_CONTABIL). */
    data: string;
    lote: string;
    movimentos: MovimentoContabilXtpg[];
}

/** Status (ID textual) usado no Header – não é o ENUM E/P/S da Entrada. */
export type StatusSaida = "AGUARDANDO" | "INTEGRADO" | "ERRO";

/** Resultado da operação `MudarStatusMovimentoParContabil`. */
export interface ResultadoMudarStatus {
    sucesso: boolean;
    requestXml: string;
    responseXml: string | null;
    mensagem: string | null;
}

/** Resultado do `ListarMovimentosContabeisPeloStatus`. */
export interface ResultadoListarMovimentos {
    movimentos: MovimentoContabilXtpg[];
    requestXml: string;
    responseXml: string | null;
    erro: string | null;
}
