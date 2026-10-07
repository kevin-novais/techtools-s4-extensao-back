import AppError from '@/util/AppError';

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE';

export interface QueryFilter {
    column: string;
    operator: FilterOperator;
    value: string | number;
}

export interface QueryOrder {
    column: string;
    direction: 'ASC' | 'DESC';
}

export interface BuildQueryResult {
    sql: string;
    params: (string | number)[];
}

export interface BuildQueryOptions {
    baseQuery: string;
    filters?: QueryFilter[];
    orderBy?: QueryOrder;
    page?: number;
    pageSize?: number;
    exportMode?: boolean;
    paramOffset?: number;
}

const ALLOWED_OPERATORS = new Set<string>(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE']);
const SAFE_COLUMN_REGEX = /^[\w.]+$/;
const MAX_PAGE_SIZE = 200;
const SIMPLE_ORDER_EXPRESSION_REGEX = /^[\w.[\]"]+$/;

function isTopLevelOrderByToken(query: string, index: number): boolean {
    const chunk = query.slice(index);
    const orderByMatch = /^ORDER\s+BY\b/i.exec(chunk);
    if (!orderByMatch) {
        return false;
    }

    const previousChar = query[index - 1];
    return !previousChar || /\s/.test(previousChar);
}

function getQuoteStateTransition(query: string, index: number, inString: boolean) {
    if (query[index] !== "'") {
        return { handled: false, inString, skipNextChar: false };
    }

    const isEscapedQuote = inString && query[index + 1] === "'";
    if (isEscapedQuote) {
        return { handled: true, inString, skipNextChar: true };
    }

    return { handled: true, inString: !inString, skipNextChar: false };
}

function getDepthTransition(char: string, depth: number) {
    if (char === '(') {
        return { handled: true, depth: depth + 1 };
    }

    if (char === ')') {
        return { handled: true, depth: Math.max(depth - 1, 0) };
    }

    return { handled: false, depth };
}

function splitTopLevelOrderBy(query: string): { queryWithoutOrderBy: string; topLevelOrderByClause?: string } {
    const normalizedQuery = query.trim();
    let depth = 0;
    let inString = false;
    let topLevelOrderByIndex = -1;

    for (let index = 0; index < normalizedQuery.length; index += 1) {
        const currentChar = normalizedQuery[index];

        const quoteTransition = getQuoteStateTransition(normalizedQuery, index, inString);
        if (quoteTransition.handled) {
            inString = quoteTransition.inString;
            if (quoteTransition.skipNextChar) {
                index += 1;
            }
            continue;
        }

        if (inString) {
            continue;
        }

        const depthTransition = getDepthTransition(currentChar, depth);
        if (depthTransition.handled) {
            depth = depthTransition.depth;
            continue;
        }

        if (depth !== 0) {
            continue;
        }

        if (!isTopLevelOrderByToken(normalizedQuery, index)) {
            continue;
        }

        topLevelOrderByIndex = index;
    }

    if (topLevelOrderByIndex < 0) {
        return { queryWithoutOrderBy: normalizedQuery };
    }

    return {
        queryWithoutOrderBy: normalizedQuery.slice(0, topLevelOrderByIndex).trim(),
        topLevelOrderByClause: normalizedQuery.slice(topLevelOrderByIndex).trim(),
    };
}

function splitByTopLevelComma(input: string): string[] {
    let depth = 0;
    let inString = false;
    let startIndex = 0;
    const parts: string[] = [];

    for (let index = 0; index < input.length; index += 1) {
        const currentChar = input[index];
        const quoteTransition = getQuoteStateTransition(input, index, inString);

        if (quoteTransition.handled) {
            inString = quoteTransition.inString;
            if (quoteTransition.skipNextChar) {
                index += 1;
            }
            continue;
        }

        const depthTransition = getDepthTransition(currentChar, depth);
        if (depthTransition.handled) {
            depth = depthTransition.depth;
            continue;
        }

        if (currentChar !== ',' || inString || depth !== 0) {
            continue;
        }

        parts.push(input.slice(startIndex, index).trim());
        startIndex = index + 1;
    }

    const remaining = input.slice(startIndex).trim();
    if (remaining) {
        parts.push(remaining);
    }

    return parts;
}

function normalizeIdentifier(identifier: string): string {
    return identifier
        .replaceAll(/^\[|\]$/g, '')
        .replaceAll(/^"|"$/g, '')
        .trim()
        .toLowerCase();
}

function extractAliasMapFromSelect(queryWithoutOrderBy: string): Map<string, string> {
    const aliasMap = new Map<string, string>();
    const selectMatch = /^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i.exec(queryWithoutOrderBy);

    if (!selectMatch?.[1]) {
        return aliasMap;
    }

    const projections = splitByTopLevelComma(selectMatch[1]);
    for (const projection of projections) {
        const aliasMatch = /^(?<expr>[\s\S]+?)\s+AS\s+(?<alias>\[[^\]]+\]|"[^"]+"|\w+)\s*$/i.exec(projection);
        if (!aliasMatch?.groups?.expr || !aliasMatch.groups.alias) {
            continue;
        }

        const rawExpr = aliasMatch.groups.expr.trim();
        const normalizedAlias = normalizeIdentifier(aliasMatch.groups.alias);
        if (!normalizedAlias) {
            continue;
        }

        const expressionParts = rawExpr.split('.');
        const expressionLastPart = expressionParts.at(-1) ?? rawExpr;
        const normalizedExpr = normalizeIdentifier(rawExpr);
        const normalizedExprLastPart = normalizeIdentifier(expressionLastPart);

        aliasMap.set(normalizedExpr, normalizedAlias);
        aliasMap.set(normalizedExprLastPart, normalizedAlias);
    }

    return aliasMap;
}

function resolveOrderExpressionColumn(expression: string, aliasMap: Map<string, string>): string | null {
    if (!SIMPLE_ORDER_EXPRESSION_REGEX.test(expression)) {
        return null;
    }

    const normalizedExpression = normalizeIdentifier(expression);
    if (!normalizedExpression) {
        return null;
    }

    const mappedAlias = aliasMap.get(normalizedExpression);
    if (mappedAlias) {
        return mappedAlias;
    }

    const expressionParts = expression.split('.');
    const lastPart = expressionParts.at(-1) ?? expression;
    const normalizedLastPart = normalizeIdentifier(lastPart);
    if (!normalizedLastPart) {
        return null;
    }

    return aliasMap.get(normalizedLastPart) ?? normalizedLastPart;
}

function normalizeBaseOrderByItems(orderByClauseBody: string, aliasMap: Map<string, string>): string[] | null {
    const items = splitByTopLevelComma(orderByClauseBody);
    if (items.length === 0) {
        return null;
    }

    const normalizedItems: string[] = [];
    for (const item of items) {
        const trimmedItem = item.trim();
        const itemMatch = /^(?<expr>.+?)(?:\s+(?<direction>ASC|DESC))?$/i.exec(trimmedItem);
        if (!itemMatch?.groups?.expr) {
            return null;
        }

        const expression = itemMatch.groups.expr.trim();
        const direction = itemMatch.groups.direction?.toUpperCase();
        const resolvedColumn = resolveOrderExpressionColumn(expression, aliasMap);
        if (!resolvedColumn) {
            return null;
        }

        const safeDirection = direction === 'DESC' ? 'DESC' : 'ASC';
        normalizedItems.push(`_rel.[${resolvedColumn}] ${safeDirection}`);
    }

    return normalizedItems;
}

function buildOrderClauseFromBaseQuery(
    topLevelOrderByClause: string | undefined,
    queryWithoutOrderBy: string,
): string | null {
    if (!topLevelOrderByClause) {
        return null;
    }

    const clauseBody = topLevelOrderByClause.replace(/^ORDER\s+BY\s+/i, '').trim();
    if (!clauseBody) {
        return null;
    }

    const aliasMap = extractAliasMapFromSelect(queryWithoutOrderBy);
    const normalizedItems = normalizeBaseOrderByItems(clauseBody, aliasMap);
    if (!normalizedItems) {
        return null;
    }

    return `ORDER BY ${normalizedItems.join(', ')}`;
}

function assertSafeColumn(column: string): void {
    if (!SAFE_COLUMN_REGEX.test(column)) {
        throw new AppError(`Nome de coluna inválido: "${column}"`, 400);
    }
}

function assertSafeOperator(operator: string): FilterOperator {
    if (!ALLOWED_OPERATORS.has(operator)) {
        throw new AppError(`Operador não permitido: "${operator}"`, 400);
    }
    return operator as FilterOperator;
}

export function buildFilteredQuery(options: BuildQueryOptions): BuildQueryResult {
    const {
        baseQuery,
        filters = [],
        orderBy,
        page = 1,
        pageSize = 50,
        exportMode = false,
        paramOffset = 0,
    } = options;

    const { queryWithoutOrderBy: sanitizedBaseQuery, topLevelOrderByClause } = splitTopLevelOrderBy(baseQuery);
    const params: (string | number)[] = [];
    const clauses: string[] = [];

    for (const filter of filters) {
        assertSafeColumn(filter.column);
        const op = assertSafeOperator(filter.operator);
        params.push(filter.value);
        clauses.push(`_rel.[${filter.column}] ${op} @p${paramOffset + params.length}`);
    }

    if (orderBy) {
        assertSafeColumn(orderBy.column);
        if (orderBy.direction !== 'ASC' && orderBy.direction !== 'DESC') {
            throw new AppError('Direção de ordenação inválida: use ASC ou DESC', 400);
        }
    }

    // Em exportMode o chamador controla o tamanho da página (chunk de streaming),
    // sem o teto de MAX_PAGE_SIZE usado pela paginação normal da grade.
    const clampedPageSize = exportMode ? Math.max(pageSize, 1) : Math.min(pageSize, MAX_PAGE_SIZE);
    const offset = (Math.max(page, 1) - 1) * clampedPageSize;

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderClauseFromBase = buildOrderClauseFromBaseQuery(topLevelOrderByClause, sanitizedBaseQuery);
    const orderClause = orderBy
        ? `ORDER BY _rel.[${orderBy.column}] ${orderBy.direction}`
        : (orderClauseFromBase ?? 'ORDER BY (SELECT NULL)');
    const paginationClause = `OFFSET ${offset} ROWS FETCH NEXT ${clampedPageSize} ROWS ONLY`;

    const sql = `
        SELECT * FROM (
            ${sanitizedBaseQuery}
        ) AS _rel
        ${whereClause}
        ${orderClause}
        ${paginationClause}
    `.trim();

    return { sql, params };
}

export function buildCountQuery(
    baseQuery: string,
    filters: QueryFilter[] = [],
    paramOffset = 0,
): BuildQueryResult {
    const { queryWithoutOrderBy: sanitizedBaseQuery } = splitTopLevelOrderBy(baseQuery);
    const params: (string | number)[] = [];
    const clauses: string[] = [];

    for (const filter of filters) {
        assertSafeColumn(filter.column);
        const op = assertSafeOperator(filter.operator);
        params.push(filter.value);
        clauses.push(`_count.[${filter.column}] ${op} @p${paramOffset + params.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
        SELECT COUNT(*) AS total FROM (
            ${sanitizedBaseQuery}
        ) AS _count
        ${whereClause}
    `.trim();

    return { sql, params };
}
