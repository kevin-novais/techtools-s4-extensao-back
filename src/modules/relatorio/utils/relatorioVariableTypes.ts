export const RELATORIO_VARIAVEL_TIPOS = ['STRING', 'NUMBER', 'DATE', 'DATETIME'] as const;
export type RelatorioVariavelTipo = (typeof RELATORIO_VARIAVEL_TIPOS)[number];

export const RELATORIO_DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const VARIABLE_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/;

/** Pattern sem flag global — instancie com `createPlaceholderRegex()` para iteração. */
export const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]{0,49})\}\}/;

export function createPlaceholderRegex(): RegExp {
    return new RegExp(PLACEHOLDER_PATTERN.source, 'g');
}

export function variavelSupportsFusoHorario(tipo: RelatorioVariavelTipo | string): boolean {
    return tipo === 'DATE' || tipo === 'DATETIME';
}

export function normalizeFusoHorarioBrasil(
    tipo: RelatorioVariavelTipo,
    fusoHorarioBrasil?: boolean,
): boolean {
    if (!variavelSupportsFusoHorario(tipo)) {
        return false;
    }

    return fusoHorarioBrasil === true;
}

export interface RelatorioVariavelInput {
    chave: string;
    label: string;
    tipo: RelatorioVariavelTipo;
    obrigatorio: boolean;
    fusoHorarioBrasil?: boolean;
    ordem: number;
}

export type ReportVariableValues = Record<string, string | number>;

export function mapStoredVariavelToInput(variavel: {
    chave: string;
    label: string;
    tipo: string;
    obrigatorio: boolean;
    fusoHorarioBrasil?: boolean;
    ordem: number;
}): RelatorioVariavelInput {
    const tipo = variavel.tipo as RelatorioVariavelTipo;

    return {
        chave: variavel.chave,
        label: variavel.label,
        tipo,
        obrigatorio: variavel.obrigatorio,
        fusoHorarioBrasil: normalizeFusoHorarioBrasil(tipo, variavel.fusoHorarioBrasil),
        ordem: variavel.ordem,
    };
}
