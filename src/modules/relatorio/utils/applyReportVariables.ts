import AppError from '@/util/AppError';
import {
    parseDateAsBrazilian,
    parseDateForFilter,
    parseDateTimeAsBrazilian,
    parseDateTimeUtc,
} from '@/util/date';
import {
    createPlaceholderRegex,
    normalizeFusoHorarioBrasil,
    RelatorioVariavelInput,
    ReportVariableValues,
} from '@/modules/relatorio/utils/relatorioVariableTypes';

export interface ApplyReportVariablesResult {
    resolvedQuery: string;
    variableParams: (string | number | Date)[];
}

function isEmptyValue(rawValue: string | number | undefined | null): boolean {
    if (rawValue === undefined || rawValue === null) {
        return true;
    }

    if (typeof rawValue === 'string') {
        return rawValue.trim() === '';
    }

    return false;
}

function coerceVariableValue(
    variavel: RelatorioVariavelInput,
    rawValue: string | number | undefined,
): string | number | Date {
    if (isEmptyValue(rawValue)) {
        throw new AppError(
            `Parâmetro obrigatório não informado: ${variavel.label}`,
            400,
        );
    }

    if (variavel.tipo === 'STRING') {
        const value = String(rawValue).trim();
        if (!value) {
            throw new AppError(`Valor inválido para ${variavel.label}: esperado STRING`, 400);
        }
        return value;
    }

    if (variavel.tipo === 'NUMBER') {
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(numeric)) {
            throw new AppError(`Valor inválido para ${variavel.label}: esperado NUMBER`, 400);
        }
        return numeric;
    }

    const usaFusoBrasil = normalizeFusoHorarioBrasil(
        variavel.tipo,
        variavel.fusoHorarioBrasil,
    );

    if (variavel.tipo === 'DATETIME') {
        const dateTimeStr = String(rawValue).trim();
        try {
            if (usaFusoBrasil) {
                return parseDateTimeAsBrazilian(dateTimeStr);
            }

            return parseDateTimeUtc(dateTimeStr);
        } catch {
            throw new AppError(
                `Valor inválido para ${variavel.label}: esperado DATETIME (YYYY-MM-DDTHH:mm)`,
                400,
            );
        }
    }

    const dateStr = String(rawValue).trim();
    try {
        if (usaFusoBrasil) {
            return parseDateAsBrazilian(dateStr);
        }

        return parseDateForFilter(dateStr);
    } catch {
        throw new AppError(`Valor inválido para ${variavel.label}: esperado DATE (YYYY-MM-DD)`, 400);
    }
}

function validateRequiredVariableValues(
    variaveis: RelatorioVariavelInput[],
    values: ReportVariableValues,
): void {
    for (const variavel of variaveis) {
        if (!variavel.obrigatorio) {
            continue;
        }

        if (isEmptyValue(values[variavel.chave])) {
            throw new AppError(
                `Parâmetro obrigatório não informado: ${variavel.label}`,
                400,
            );
        }
    }
}

export function applyReportVariables(
    baseQuery: string,
    variaveis: RelatorioVariavelInput[],
    values: ReportVariableValues = {},
): ApplyReportVariablesResult {
    const definicoesPorChave = new Map(variaveis.map((v) => [v.chave, v]));
    const variableParams: (string | number | Date)[] = [];
    let paramIndex = 0;

    const unknownKeys = Object.keys(values).filter((key) => !definicoesPorChave.has(key));
    if (unknownKeys.length > 0) {
        throw new AppError(
            `Parâmetro não definido para este relatório: ${unknownKeys[0]}`,
            400,
        );
    }

    validateRequiredVariableValues(variaveis, values);

    const placeholderRegex = createPlaceholderRegex();
    const resolvedQuery = baseQuery.replace(placeholderRegex, (_match, chave: string) => {
        const variavel = definicoesPorChave.get(chave);
        if (!variavel) {
            throw new AppError(
                `Parâmetro não definido para este relatório: ${chave}`,
                400,
            );
        }

        paramIndex += 1;
        variableParams.push(coerceVariableValue(variavel, values[chave]));
        return `@p${paramIndex}`;
    });

    const remainingPlaceholders = extractRemainingPlaceholders(resolvedQuery);
    if (remainingPlaceholders.length > 0) {
        throw new AppError(
            `A query referencia parâmetro não cadastrado: {{${remainingPlaceholders[0]}}}`,
            400,
        );
    }

    return { resolvedQuery, variableParams };
}

function extractRemainingPlaceholders(query: string): string[] {
    const keys: string[] = [];
    const regex = createPlaceholderRegex();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(query)) !== null) {
        keys.push(match[1]);
    }

    return keys;
}
