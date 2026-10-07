import AppError from '@/util/AppError';
import {
    createPlaceholderRegex,
    normalizeFusoHorarioBrasil,
    RelatorioVariavelInput,
    variavelSupportsFusoHorario,
    VARIABLE_KEY_REGEX,
} from '@/modules/relatorio/utils/relatorioVariableTypes';

export function extractPlaceholderKeys(query: string): string[] {
    const keys = new Set<string>();
    const regex = createPlaceholderRegex();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(query)) !== null) {
        keys.add(match[1]);
    }

    return [...keys];
}

export function validateVariableDefinitions(
    query: string,
    variaveis: RelatorioVariavelInput[],
): void {
    const chavesDefinidas = new Set<string>();

    for (const variavel of variaveis) {
        if (!VARIABLE_KEY_REGEX.test(variavel.chave)) {
            throw new AppError(`Chave de variável inválida: "${variavel.chave}"`, 400);
        }

        if (chavesDefinidas.has(variavel.chave)) {
            throw new AppError(`Chave de variável duplicada: "${variavel.chave}"`, 400);
        }

        chavesDefinidas.add(variavel.chave);
    }

    const chavesNaQuery = extractPlaceholderKeys(query);
    const chavesNaQuerySet = new Set(chavesNaQuery);

    for (const chave of chavesNaQuery) {
        if (!chavesDefinidas.has(chave)) {
            throw new AppError(
                `A query referencia parâmetro não cadastrado: {{${chave}}}`,
                400,
            );
        }
    }

    for (const variavel of variaveis) {
        const usadaNaQuery = chavesNaQuerySet.has(variavel.chave);

        if (!usadaNaQuery && variavel.obrigatorio) {
            throw new AppError(
                `A variável "${variavel.chave}" não é utilizada na query`,
                400,
            );
        }

        if (usadaNaQuery && !variavel.obrigatorio) {
            throw new AppError(
                `A variável "${variavel.chave}" está na query e deve ser marcada como obrigatória`,
                400,
            );
        }

        if (variavel.fusoHorarioBrasil && !variavelSupportsFusoHorario(variavel.tipo)) {
            throw new AppError(
                `Fuso horário do Brasil só pode ser usado em variáveis do tipo DATE ou DATETIME: "${variavel.chave}"`,
                400,
            );
        }
    }
}

export function normalizeVariaveisForPersistence(
    variaveis: RelatorioVariavelInput[],
): RelatorioVariavelInput[] {
    return variaveis.map((variavel) => ({
        ...variavel,
        fusoHorarioBrasil: normalizeFusoHorarioBrasil(variavel.tipo, variavel.fusoHorarioBrasil),
    }));
}
