/**
 * Spec de mapeamento Movimento (XTPG) <- view de origem, por fluxo.
 *
 * Fonte da verdade: views reais em `s4_extensao_dotz`
 *   - PREVISTO  -> `XRT_SendPrevPagto`
 *   - REALIZADO -> `XRT_SendFlux`
 * + decompilado `WebMethods.SendFinanceiroPrevisto` / `SendFinanceiroRealizado`.
 *
 * Cada spec é uma LISTA ORDENADA de tags (a ordem vira a ordem do envelope SOAP).
 * Diferenças relevantes entre os fluxos:
 *   - `DocPagador` = data atual (yyyyMMdd), constante (não é coluna).
 *   - `Temperatura` = const "1" no previsto; coluna `temperatura` no realizado.
 *   - `Historico` só existe no envelope do previsto.
 *   - `ContaContabil`/`InformacoesContabeis` vêm de colunas diferentes em cada fluxo.
 *   - `OrigemSistema` do realizado vem direto da coluna `Diario_original2` (a view já retorna AR/AP/GL).
 *
 * Para manutenção, basta editar as colunas/constantes aqui.
 */
import type { XtpgMovimentoTag } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

/** Origem de um valor de tag. */
export type XtpgSource =
    | { kind: "column"; column: string; transform?: "raw" | "valor" | "dateIso" }
    | { kind: "const"; value: string }
    | { kind: "nowYmd" };

export interface XtpgTagSpec {
    tag: XtpgMovimentoTag;
    source: XtpgSource;
    /** Limite de caracteres do campo no XTPG; acima disso o valor é truncado. */
    maxLen?: number;
}

export interface XtpgFlowSpec {
    /** Tags ordenadas que compõem o `<deep:Movimento>`. */
    tags: XtpgTagSpec[];
    /** Coluna informativa de "tabela"/objtype (log). */
    origemTabelaColumn: string;
    /** Coluna com a chave 4-partes (DocEntry/CHAVE) p/ write-back em registros_contabeis. */
    origemChaveColumn: string;
    /**
     * (Previsto) Quando presente, a chave é montada concatenando estas 4 colunas com "-"
     * em vez de usar `origemChaveColumn` diretamente. Usado na view XRT_SendPrevPagto
     * que expõe a PK decomposta (Company_code, fiscal_year, accounting_document,
     * Accounting_document_item) em vez de uma coluna CHAVE já formatada.
     */
    origemChaveColumns?: [string, string, string, string];
    /**
     * (Realizado) Colunas da view "congeladas" em registros_contabeis (sav_*) no envio,
     * para sobreviver à limpeza do SAP na reversão. Ausente no previsto.
     */
    savColumns?: {
        savClearAccDoc: string;
        savClearDocFiscalYear: string;
        savClearItem: string;
        savRevDoc: string;
        savRevDocFiscalYear: string;
        /**
         * (DTZ-245) Colunas de fallback `p_*` da view. No cenário de reversão os campos
         * `clearing_*` vêm vazios (a limpeza dos filhos zera os clearing_*), então a view
         * expõe o conjunto congelado `p_*` como base do compensador. Usadas quando o
         * `clearing_*` correspondente estiver vazio.
         */
        fallbackClearAccDoc?: string;
        fallbackClearDocFiscalYear?: string;
        fallbackClearItem?: string;
    };
    ultPkEnviadaColumn?: string;
    ultDocPgtoSelfColumn?: string;
}

const col = (
    column: string,
    transform: "raw" | "valor" | "dateIso" = "raw",
): XtpgSource => ({ kind: "column", column, transform });

/** PREVISTO -> XRT_SendPrevPagto */
export const XTPG_SPEC_PREVISTO: XtpgFlowSpec = {
    tags: [
        { tag: "PfjNome", source: col("CardName") },
        { tag: "PfjCpf", source: col("CNPJ_fornecedor") },
        { tag: "BanCodigo", source: col("Banco") },
        { tag: "AgeCodigo", source: col("Agencia") },
        { tag: "CntCodigo", source: col("Conta") },
        { tag: "TdpCodigo", source: col("Forma_de_pgto") },
        { tag: "DocPagador", source: { kind: "nowYmd" } },
        { tag: "PfjCodigo", source: col("Empresa") },
        { tag: "ValorOriginal", source: col("Valor", "valor") },
        { tag: "Valor", source: col("Valor", "valor") },
        { tag: "DocOrigem", source: col("DOC_ORIGEM"), maxLen: 15 },
        { tag: "Historico", source: col("comments") },
        { tag: "ContaContabil", source: col("AcctCode") },
        { tag: "Temperatura", source: { kind: "const", value: "1" } },
        { tag: "OrigemSistema", source: col("ObjType") },
        { tag: "OrigemPk", source: col("DocEntry") },
        { tag: "MmiCodigo", source: col("Flx_de_Caixa") },
        { tag: "InformacoesContabeis", source: col("AcctCode") },
        { tag: "DataCaixa", source: col("Vencimento", "dateIso") },
        { tag: "DataCompetencia", source: col("Vencimento", "dateIso") },
        { tag: "DataPagamento", source: col("Vencimento", "dateIso") },
        { tag: "Dff01", source: col("fornecedor") },
        { tag: "Dff02", source: col("DOC_ORIGEM") },
        { tag: "MoedaCodigo", source: { kind: "const", value: "BRL" } },
    ],
    origemTabelaColumn: "ObjTypeSAP",
    origemChaveColumn: "DocEntry",
    origemChaveColumns: [
        "Company_code",
        "fiscal_year",
        "accounting_document",
        "Accounting_document_item",
    ],
    ultPkEnviadaColumn: "DocEntry",
};

/** REALIZADO -> XRT_SendFlux (sem Historico; Temperatura e OrigemSistema próprios) */
export const XTPG_SPEC_REALIZADO: XtpgFlowSpec = {
    tags: [
        { tag: "PfjNome", source: col("Nome_do_cliente_fornecedor") },
        { tag: "PfjCpf", source: col("CNPJ_Fornecedor") },
        { tag: "BanCodigo", source: col("Banco") },
        { tag: "AgeCodigo", source: col("Agencia") },
        { tag: "CntCodigo", source: col("Conta") },
        { tag: "TdpCodigo", source: col("Forma_de_Pagamento") },
        { tag: "DocPagador", source: { kind: "nowYmd" } },
        { tag: "PfjCodigo", source: col("Empresa") },
        { tag: "ValorOriginal", source: col("Liq", "valor") },
        { tag: "Valor", source: col("Liq", "valor") },
        // DTZ-284: a tag leva sempre o CÓDIGO da conta; a descrição (Descr_Conta_contabil)
        // não é usada pelo XTPG, que casa o valor com o próprio plano de contas.
        { tag: "ContaContabil", source: col("Conta_contabil") },
        { tag: "OrigemSistema", source: col("Diario_original2") },
        { tag: "OrigemPk", source: col("Chave_da_transacao") },
        { tag: "MmiCodigo", source: col("CFWId") },
        { tag: "Temperatura", source: col("temperatura") },
        { tag: "DocOrigem", source: col("Nr_Nota"), maxLen: 15 },
        // DTZ-284: a tag leva a CONTRAPARTIDA, não a própria conta de origem. Até o
        // DTZ-273 as duas eram a mesma coluna; de lá para cá Conta_contabil virou a conta
        // de origem e a contrapartida ganhou coluna própria na view.
        { tag: "InformacoesContabeis", source: col("Conta_contrapartida") },
        { tag: "DataCaixa", source: col("Data_de_lancamento", "dateIso") },
        { tag: "DataCompetencia", source: col("Data_de_lancamento", "dateIso") },
        { tag: "DataPagamento", source: col("Data_de_lancamento", "dateIso") },
        { tag: "Dff01", source: col("Cod_Fornecedor") },
        { tag: "Dff02", source: col("Nr_Nota") },
        { tag: "MoedaCodigo", source: { kind: "const", value: "BRL" } },
    ],
    origemTabelaColumn: "OBJ",
    origemChaveColumn: "CHAVE",
    origemChaveColumns: [
        "Company_code",
        "fiscal_year",
        "accounting_document",
        "Accounting_document_item",
    ],
    savColumns: {
        savClearAccDoc: "clearing_accounting_document",
        savClearDocFiscalYear: "clearing_doc_fiscal_year",
        savClearItem: "clearing_item",
        savRevDoc: "reverse_document",
        savRevDocFiscalYear: "reverse_document_fiscal_year",
        // DTZ-245: base congelada exposta pela view XRT_SendFlux para o cenário de reversão.
        fallbackClearAccDoc: "p_accounting_document",
        fallbackClearDocFiscalYear: "p_fiscal_year",
        fallbackClearItem: "P_clearing_item",
    },
    ultDocPgtoSelfColumn: "clearing_accounting_document",
};
