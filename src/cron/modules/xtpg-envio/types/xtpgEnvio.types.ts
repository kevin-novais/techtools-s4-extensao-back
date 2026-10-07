/**
 * Tipos do módulo de Envio XTPG (DeepXRT - SendPrev / SendFlux).
 *
 * Fonte da verdade do mapeamento: views reais `XRT_SendPrevPagto` (previsto) e
 * `XRT_SendFlux` (realizado) em `s4_extensao_dotz` + decompilado `WebMethods.cs`
 * (EnviarListaMovimentoCaixaAssinc). Os dois fluxos têm envelopes ligeiramente
 * diferentes (ex.: realizado NÃO envia `Historico`; `Temperatura` é constante=1 no
 * previsto e coluna no realizado), por isso o mapeamento é um spec ORDENADO por fluxo.
 */

/** Fluxo de envio. */
export type XtpgFluxo = "PREVISTO" | "REALIZADO";

/** Nomes de tag do Movimento (sem o prefixo `deep:`). */
export type XtpgMovimentoTag =
    | "PfjNome"
    | "PfjCpf"
    | "BanCodigo"
    | "AgeCodigo"
    | "CntCodigo"
    | "TdpCodigo"
    | "DocPagador"
    | "PfjCodigo"
    | "ValorOriginal"
    | "Valor"
    | "DocOrigem"
    | "Historico"
    | "ContaContabil"
    | "Temperatura"
    | "OrigemSistema"
    | "OrigemPk"
    | "MmiCodigo"
    | "InformacoesContabeis"
    | "DataCaixa"
    | "DataCompetencia"
    | "DataPagamento"
    | "Dff01"
    | "Dff02"
    | "MoedaCodigo";

/** Par tag/valor já resolvido (para montar o envelope na ordem correta). */
export interface XtpgTagValue {
    tag: XtpgMovimentoTag;
    value: string;
}

/** Dados de origem do registro (rastreio + write-back em registros_contabeis). */
export interface OrigemXtpg {
    /** Coluna de "tabela"/objtype da view (informativo no log). */
    tabela: string | null;
    /** Chave 4-partes "Company-fiscal-doc-item" (DocEntry / CHAVE) p/ write-back. */
    chave: string | null;
}

/**
 * Snapshot (realizado) dos campos de compensação/reversão da view, "congelados" em
 * registros_contabeis (sav_*) no momento do envio — o SAP limpa esses campos na reversão,
 * então precisamos guardá-los para conseguir reverter no XTPG depois.
 */
export interface SavFieldsXtpg {
    savClearAccDoc: string | null;
    savClearDocFiscalYear: string | null;
    savClearItem: string | null;
    savRevDoc: string | null;
    savRevDocFiscalYear: string | null;
}

export interface WriteBackXtpg {
    ultPkEnviada?: string | null;
}

/** Movimento resolvido a partir de uma linha da view. */
export interface MovimentoResolvido {
    /** Tags ordenadas (para o envelope SOAP). */
    ordered: XtpgTagValue[];
    /** Mapa tag -> valor (para preencher o DETAIL denormalizado). */
    byTag: Partial<Record<XtpgMovimentoTag, string>>;
    origem: OrigemXtpg;
    /** Snapshot sav_* (só no realizado; null no previsto). */
    savFields: SavFieldsXtpg | null;
    writeBack?: WriteBackXtpg;
}

/** Resultado por movimento retornado pela XTPG após o envio do lote. */
export interface ResultadoMovimentoXtpg {
    idXrt: string | null;
    mensagemErro: string | null;
    sucesso: boolean;
}

/** Resultado do envio de um lote (request + resposta bruta + status por movimento). */
export interface ResultadoLoteXtpg {
    requestXml: string;
    responseXml: string | null;
    /** Um resultado por movimento, na MESMA ordem do lote enviado. */
    resultados: ResultadoMovimentoXtpg[];
    /** Erro de transporte/lote (falha de rede, status HTTP, etc.). */
    erroLote: string | null;
}

/** Métricas agregadas de uma execução do cron. */
export interface ResumoEnvioXtpg {
    totalLidos: number;
    totalLotes: number;
    totalEnviados: number;
    totalErros: number;
}

export const XTPG_DETAIL_STATUS = {
    ENVIADO: "ENVIADO",
    ERRO: "ERRO",
} as const;

export const XTPG_HEADER_STATUS = {
    PROCESSANDO: "PROCESSANDO",
    ENVIADO: "ENVIADO",
    PARCIAL: "PARCIAL",
    ERRO: "ERRO",
} as const;

export type XtpgRegistroStatusKind = "PROCESSANDO" | "SUCESSO" | "ERRO";

export const XTPG_FLUXO_STATUS_SUFFIX: Record<XtpgFluxo, string> = {
    PREVISTO: "PREV",
    REALIZADO: "FLUX",
};

export function buildStatusParaEnvio(fluxo: XtpgFluxo, kind: XtpgRegistroStatusKind): string {
    return `${kind}_${XTPG_FLUXO_STATUS_SUFFIX[fluxo]}`;
}
