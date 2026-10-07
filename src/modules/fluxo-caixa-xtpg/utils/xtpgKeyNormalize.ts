/**
 * Normaliza código de empresa para PKs XTPG e lookups (wildcard = string vazia).
 */
export function normalizeXtpgCompanyCode(raw: string): string {
    const t = raw.trim();
    if (t === "") return "";
    return t;
}

/**
 * Chave IsReversed alinhada ao sync SAP: "X" ou "" (nunca null na PK).
 */
export function normalizeIsReversedKey(value: string | null | undefined): string {
    if (value === "X") return "X";
    return "";
}

export function normalizeReversalReasonKey(value: string | null | undefined): string {
    if (value == null) return "";
    return value.trim().slice(0, 2);
}

export function normalizeDebitCreditKey(value: string): string {
    const u = value.trim().toUpperCase();
    return u;
}
