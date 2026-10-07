export function normalizeItemFluxoXtpgValue(value: string | null | undefined): string {
    if (value == null) return "";
    return value.trim();
}

/// Valores que NAO representam um item de fluxo de caixa classificado. Nenhum deles
/// existe na tabela `item_fluxo_caixa`, entao enviar qualquer um ao XTPG resulta em
/// item nao resolvivel. Fonte unica: o gate das views e a varredura do classificador
/// derivam desta lista.
export const ITEM_FLUXO_XTPG_RESERVADOS = ["", "0", "999"] as const;

export function isReservedItemFluxoXtpg(value: string | null | undefined): boolean {
    const v = normalizeItemFluxoXtpgValue(value).toLowerCase();
    return ITEM_FLUXO_XTPG_RESERVADOS.some((reservado) => reservado === v);
}

export function isValidClassifiedItemFluxoXtpg(value: string | null | undefined): boolean {
    return !isReservedItemFluxoXtpg(value);
}

export function normalizeSapDocReference(value: string | null | undefined): string | null {
    const v = (value ?? "").trim();
    if (v === "") return null;
    if (v === "0") return null;
    return v;
}
