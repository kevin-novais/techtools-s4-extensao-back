/**
 * Formata um valor numérico para o formato de moeda brasileira (R$ X.XXX,XX)
 * @param value - Valor numérico (number, string ou Decimal)
 * @returns String formatada em real brasileiro
 */
export const numberFormatter = (value: number | string | null | undefined, precision: number = 2): string => {
    if (value === null || value === undefined || value === "") {
        return "R$ 0,00";
    }

    // Converte para número
    const numValue = typeof value === "string" ? parseFloat(value) : Number(value);

    // Verifica se é um número válido
    if (isNaN(numValue)) {
        return "R$ 0,00";
    }

    // Formata usando o locale brasileiro
    return numValue.toLocaleString("pt-BR", {
        currency: "BRL",
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
};
