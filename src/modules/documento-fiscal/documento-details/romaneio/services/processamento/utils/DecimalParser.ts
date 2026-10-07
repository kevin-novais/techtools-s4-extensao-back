import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import type { NullableNumericValue } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

/**
 * Converte valores numéricos brasileiros para Decimal (tipo do Prisma)
 * 
 * FORMATOS SUPORTADOS:
 * - Número: 648.92 → Decimal(648.92)
 * - String BR: "648,92" → Decimal(648.92)
 * - String BR com milhares: "1.648,92" → Decimal(1648.92)
 * - Valores vazios/nulos: undefined/null/"" → null
 * 
 * IMPORTANTE: Planilhas Excel podem ter valores tanto como número quanto como string
 * Esta função normaliza ambos os formatos
 * 
 * @param value - Valor numérico (número ou string) a ser convertido
 * @returns Decimal do Prisma ou null se valor inválido/vazio
 */
export function parseToDecimal(value: NullableNumericValue): Decimal | null {
    // Early return: Valores vazios ou nulos
    if (value === undefined || value === null || value === "") {
        return null;
    }

    // Se já é número, converte direto para Decimal
    if (typeof value === "number") {
        return new Decimal(value);
    }

    // Normaliza string brasileira para formato internacional
    // Remove pontos (separador de milhares) e substitui vírgula por ponto
    const normalized = String(value)
        .trim()
        .replaceAll(".", "") // Remove pontos de milhar (1.648,92 → 1648,92)
        .replaceAll(",", "."); // Substitui vírgula decimal por ponto (1648,92 → 1648.92)

    // Early return: String vazia após normalização ou valor inválido
    if (normalized === "" || Number.isNaN(Number(normalized))) {
        return null;
    }

    return new Decimal(normalized);
}

/**
 * Formata um Decimal para string com 2 casas decimais
 * 
 * Usado para exibir valores monetários em mensagens de erro e logs
 * Evita problemas de precisão de ponto flutuante (ex: 17857.159999999996 → 17857.16)
 * 
 * @param value - Valor Decimal a ser formatado
 * @returns String formatada com 2 casas decimais ou "0.00" se valor inválido
 */
export function formatDecimalToMoney(value: Decimal | null | undefined): string {
    if (!value) {
        return "0.00";
    }

    return value.toFixed(2);
}

