/**
 * Converte uma linha bruta da view (XRT_SendPrevPagto / XRT_SendFlux) em um
 * `MovimentoResolvido` (tags ordenadas + mapa byTag + origem), aplicando o spec do fluxo.
 */
import type {
    MovimentoResolvido,
    SavFieldsXtpg,
    WriteBackXtpg,
    XtpgMovimentoTag,
    XtpgTagValue,
} from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";
import type {
    XtpgFlowSpec,
    XtpgSource,
} from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";

/** Linha genérica da view (chaves = nomes de coluna exatos). */
export type XtpgViewRow = Record<string, unknown>;

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

function pad3(n: number): string {
    if (n < 10) return `00${n}`;
    if (n < 100) return `0${n}`;
    return String(n);
}

/** Valor cru -> string (trim). */
function toRaw(value: unknown): string {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
}

/** Valor numérico -> string com ponto decimal (espelha `.Replace(",", ".")` do C#). */
function toValor(value: unknown): string {
    return toRaw(value).replace(",", ".");
}

/** Trunca ao limite do campo no XTPG (evita "estourou o tamanho máximo"). */
function aplicarMaxLen(value: string, maxLen?: number): string {
    return maxLen && value.length > maxLen ? value.slice(0, maxLen) : value;
}

/**
 * Normaliza data da view (Date ou string "dd/MM/yyyy [HH:mm:ss]") para Date.
 * Retorna null quando não consegue interpretar.
 */
function parseViewDate(value: unknown): Date | null {
    if (value == null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const raw = String(value).trim();
    if (!raw) return null;

    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
    if (br) {
        const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = br;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Data -> "yyyy-MM-ddT00:00:00.000" (legado força meia-noite). */
function toDateIso(value: unknown): string {
    const d = parseViewDate(value);
    if (!d) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T00:00:00.${pad3(0)}`;
}

/** Data atual -> "yyyyMMdd" (campo DocPagador). */
function nowYmd(): string {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function resolveSource(row: XtpgViewRow, source: XtpgSource): string {
    switch (source.kind) {
        case "const":
            return source.value;
        case "nowYmd":
            return nowYmd();
        case "column": {
            const v = row[source.column];
            if (source.transform === "valor") return toValor(v);
            if (source.transform === "dateIso") return toDateIso(v);
            return toRaw(v);
        }
        default:
            return "";
    }
}

/** (Realizado) Lê os 5 campos de compensação/reversão da view para o snapshot sav_*. */
function resolveSavFields(row: XtpgViewRow, spec: XtpgFlowSpec): SavFieldsXtpg | null {
    if (!spec.savColumns) return null;
    const c = spec.savColumns;
    // DTZ-245: no cenário de reversão os clearing_* vêm vazios; cai para a base congelada p_*.
    const pick = (col?: string): string => (col ? toRaw(row[col]) : "");
    return {
        savClearAccDoc: pick(c.savClearAccDoc) || pick(c.fallbackClearAccDoc) || null,
        savClearDocFiscalYear: pick(c.savClearDocFiscalYear) || pick(c.fallbackClearDocFiscalYear) || null,
        savClearItem: pick(c.savClearItem) || pick(c.fallbackClearItem) || null,
        savRevDoc: toRaw(row[c.savRevDoc]) || null,
        savRevDocFiscalYear: toRaw(row[c.savRevDocFiscalYear]) || null,
    };
}

/** tag "PfjNome" -> campo do DETAIL "pfjNome" (1ª letra minúscula). */
export function tagToDetailField(tag: XtpgMovimentoTag): string {
    return tag.charAt(0).toLowerCase() + tag.slice(1);
}

/** PK composta de registros_contabeis. */
export interface RegistroContabilPk {
    CompanyCode: string;
    FiscalYear: string;
    AccountingDocument: string;
    AccountingDocumentItem: string;
}

/** Parseia a chave "Company-fiscal-doc-item" (DocEntry/CHAVE) na PK composta. */
export function parseChaveRegistro(chave: string | null | undefined): RegistroContabilPk | null {
    if (!chave) return null;
    const parts = chave.split("-");
    if (parts.length !== 4) return null;
    const [CompanyCode, FiscalYear, AccountingDocument, AccountingDocumentItem] = parts.map((s) => s.trim());
    if (!CompanyCode || !FiscalYear || !AccountingDocument || !AccountingDocumentItem) return null;
    return { CompanyCode, FiscalYear, AccountingDocument, AccountingDocumentItem };
}

/**
 * Reconstrói um MovimentoResolvido a partir de uma linha de DETAIL já gravada
 * (usado no reprocessamento/reenvio — o registro pode já ter saído da view).
 */
export function buildMovimentoFromDetail(
    detail: Record<string, unknown>,
    spec: XtpgFlowSpec,
): MovimentoResolvido {
    const ordered: XtpgTagValue[] = [];
    const byTag: Partial<Record<XtpgMovimentoTag, string>> = {};

    for (const { tag, maxLen } of spec.tags) {
        const raw = detail[tagToDetailField(tag)];
        const value = aplicarMaxLen(raw == null ? "" : String(raw), maxLen);
        ordered.push({ tag, value });
        byTag[tag] = value;
    }

    const writeBack: WriteBackXtpg = {};
    if (spec.ultPkEnviadaColumn) writeBack.ultPkEnviada = byTag.OrigemPk || null;

    return {
        ordered,
        byTag,
        origem: {
            tabela: (detail.origemTabela as string) ?? null,
            chave: (detail.origemDocEntry as string) ?? null,
        },
        savFields: null,
        writeBack,
    };
}

function resolveChave(row: XtpgViewRow, spec: XtpgFlowSpec): string {
    if (spec.origemChaveColumns) {
        const partes = spec.origemChaveColumns.map((c) => toRaw(row[c]).trim());
        if (partes.some((p) => !p)) return "";
        return partes.join("-");
    }
    return toRaw(row[spec.origemChaveColumn]);
}

/** Constrói o Movimento resolvido a partir da linha + spec do fluxo. */
export function buildMovimentoResolvido(row: XtpgViewRow, spec: XtpgFlowSpec): MovimentoResolvido {
    const ordered: XtpgTagValue[] = [];
    const byTag: Partial<Record<XtpgMovimentoTag, string>> = {};

    for (const { tag, source, maxLen } of spec.tags) {
        const value = aplicarMaxLen(resolveSource(row, source), maxLen);
        ordered.push({ tag, value });
        byTag[tag] = value;
    }

    const tabela = toRaw(row[spec.origemTabelaColumn]);
    const chave = resolveChave(row, spec);
    const writeBack: WriteBackXtpg = {};
    if (spec.ultPkEnviadaColumn) writeBack.ultPkEnviada = byTag.OrigemPk || null;

    return {
        ordered,
        byTag,
        origem: {
            tabela: tabela || null,
            chave: chave || null,
        },
        savFields: resolveSavFields(row, spec),
        writeBack,
    };
}
