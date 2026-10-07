import { parseDateForFilter, parseDateForFilterEnd } from "./date";

type FilterCondition = {
  filterType: "text" | "number" | "date";
  type: string; // equals, contains, inRange, greaterThan, etc.
  filter?: string | number;
  dateFrom?: string;
  dateTo?: string | null;
};

type CompositeFilter = {
  filterType: "date" | "text" | "number";
  operator: "AND" | "OR";
  conditions: FilterCondition[];
};

type Filters = Record<string, FilterCondition | CompositeFilter>;
type SortModelItem = {
  colId: string;
  sort: "asc" | "desc";
};
type SortModel = SortModelItem[];

// HELPERS
function normalizeDateFilterValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function buildDateRange(type: string, dateFrom?: string, dateTo?: string | null) {
  if (!dateFrom) return {};

  const normalizedDateFrom = normalizeDateFilterValue(dateFrom);
  if (!normalizedDateFrom) return {};

  const normalizedDateTo = normalizeDateFilterValue(dateTo) ?? normalizedDateFrom;
  const from = parseDateForFilter(normalizedDateFrom);
  const to = parseDateForFilterEnd(normalizedDateTo);

  switch (type) {
    case "equals":
      return { gte: from, lte: to };

    case "greaterThan":
      return { gt: parseDateForFilterEnd(normalizedDateFrom) };

    case "lessThan":
      return { lt: parseDateForFilter(normalizedDateFrom) };

    case "inRange":
      return { gte: from, lte: to };
  }

  return {};
}

function buildTextCondition(type: string, value?: string | number) {
  if (value === undefined || value === null) return {};
  if (typeof value === "string" && value.trim() === "") return {};

  const normalizedValue = typeof value === "string" ? value.trim() : value;

  switch (type) {
    case "equals":
      return { equals: normalizedValue };
    case "contains":
      return { contains: normalizedValue };
    case "startsWith":
      return { startsWith: normalizedValue };
    case "endsWith":
      return { endsWith: normalizedValue };
  }

  return {};
}

function buildNumberCondition(type: string, value?: string | number) {
  if (value === undefined || value === null) return {};

  const val = Number(value);
  if (Number.isNaN(val)) return {};

  switch (type) {
    case "equals":
      return { equals: val };
    case "greaterThan":
      return { gt: val };
    case "lessThan":
      return { lt: val };
  }

  return {};
}

function wrapRelation(
  relation: string | null,
  field: string,
  condition: Record<string, unknown>
) {
  if (field.includes(".")) {
    return buildNestedWhere(field, condition);
  }

  if (relation) {
    return { [relation]: { [field]: condition } };
  }

  return { [field]: condition };
}

function pushAnd(
  where: { AND: Record<string, unknown>[] },
  relation: string | null,
  field: string,
  condition: Record<string, unknown>
) {
  where.AND.push(wrapRelation(relation, field, condition));
}

function buildCompositeConditions(
  filter: CompositeFilter,
  relation: string | null,
  realField: string
) {
  return filter.conditions.reduce((acc, cond: FilterCondition) => {
    const condition = buildSimpleCondition(cond);
    if (!hasCondition(condition)) return acc;
    acc.push(wrapRelation(relation, realField, condition));
    return acc;
  }, [] as Record<string, unknown>[]);
}

function buildSimpleCondition(filter: FilterCondition) {
  if (filter.filterType === "date") {
    return buildDateRange(filter.type, filter.dateFrom, filter.dateTo);
  }

  if (filter.filterType === "text") {
    return buildTextCondition(filter.type, filter.filter);
  }

  if (filter.filterType === "number") {
    return buildNumberCondition(filter.type, filter.filter);
  }

  return {};
}

function hasCondition(condition: Record<string, unknown>) {
  return Object.keys(condition).length > 0;
}

function resolveRelation(fieldKey: string, relationMap: Record<string, string>) {
  const relation = relationMap[fieldKey];
  if (!relation) {
    return { relation: null, realField: fieldKey };
  }

  return { relation, realField: fieldKey.replace(`${relation}.`, "") };
}

function isCompositeFilter(filter: FilterCondition | CompositeFilter): filter is CompositeFilter {
  return "operator" in filter && Array.isArray(filter.conditions);
}

function addCompositeFilter(
  where: { AND: Record<string, unknown>[] },
  filter: CompositeFilter,
  relation: string | null,
  realField: string
) {
  const conditions = buildCompositeConditions(filter, relation, realField);
  if (conditions.length === 0) return;

  where.AND.push({
    [filter.operator]: conditions
  });
}

function addSimpleFilter(
  where: { AND: Record<string, unknown>[] },
  filter: FilterCondition,
  relation: string | null,
  realField: string
) {
  const condition = buildSimpleCondition(filter);
  if (!hasCondition(condition)) return;
  pushAnd(where, relation, realField, condition);
}

// CONVERSOR PRINCIPAL
export function agGridToPrismaFilters(
  filters: Filters,
  relationMap: Record<string, string> = {}
) {
  // Inicializamos o where com um array AND para evitar sobrescritas de operadores
  const where: any = { AND: [] };

  for (const [fieldKey, filter] of Object.entries<any>(filters)) {
    if (!filter) continue;

    const { relation, realField } = resolveRelation(fieldKey, relationMap);

    if (isCompositeFilter(filter)) {
      addCompositeFilter(where, filter, relation, realField);
      continue;
    }

    addSimpleFilter(where, filter, relation, realField);
  }

  // Limpeza: Se o array AND estiver vazio, removemos para não enviar "AND: []" desnecessário
  if (where.AND.length === 0) {
    delete where.AND;
  }

  return where;
}

export function parseAgGridFilterModel(filterModel?: string | null): Filters | null {
  if (!filterModel) return null;

  try {
    const parsed = JSON.parse(filterModel);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Filters;
  } catch {
    return null;
  }
}

export function parseAgGridSortModel(sortModel?: string | null): SortModel | null {
  if (!sortModel) return null;

  try {
    const parsed = JSON.parse(sortModel);
    if (!Array.isArray(parsed)) return null;

    const normalized = parsed
      .filter((item) => item && typeof item.colId === "string")
      .map((item) => ({
        colId: item.colId,
        sort: item.sort,
      }))
      .filter((item) => item.colId.trim() !== "" && (item.sort === "asc" || item.sort === "desc"));

    if (normalized.length === 0) return null;
    return normalized as SortModel;
  } catch {
    return null;
  }
}

export function agGridFilterModelToPrismaWhere(
  filterModel?: string | null,
  relationMap: Record<string, string> = {},
  fieldMap: Record<string, string> = {}
) {
  const parsed = parseAgGridFilterModel(filterModel);
  if (!parsed) return {};
  const normalized = normalizeFilterKeys(parsed, fieldMap);
  return agGridToPrismaFilters(normalized, relationMap);
}

export function agGridSortModelToPrismaOrderBy(
  sortModel?: string | null,
  relationMap: Record<string, string> = {},
  fieldMap: Record<string, string> = {},
  defaultOrderBy?: Record<string, unknown> | Record<string, unknown>[]
) {
  const parsed = parseAgGridSortModel(sortModel);
  if (!parsed) return defaultOrderBy;

  const orderBy = parsed
    .map((sortItem) => {
      const rawField = fieldMap[sortItem.colId] ?? sortItem.colId;
      if (!rawField || rawField.trim() === "") return null;

      if (rawField.includes(".")) {
        return buildNestedOrderBy(rawField, sortItem.sort);
      }

      const { relation, realField } = resolveRelation(rawField, relationMap);
      if (relation) {
        return { [relation]: { [realField]: sortItem.sort } };
      }

      return { [realField]: sortItem.sort };
    })
    .filter((item): item is Record<string, unknown> => item !== null);

  if (orderBy.length === 0) return defaultOrderBy;
  return orderBy;
}

export function mergePrismaWhere<T extends Record<string, unknown>>(
  baseWhere: T,
  extraWhere: Record<string, unknown>
) {
  if (!extraWhere || Object.keys(extraWhere).length === 0) return baseWhere;
  if (!baseWhere || Object.keys(baseWhere).length === 0) return extraWhere as T;
  return {
    AND: [baseWhere, extraWhere]
  };
}

function normalizeFilterKeys(filters: Filters, fieldMap: Record<string, string>) {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return filters;

  return Object.entries(filters).reduce((acc, [fieldKey, filter]) => {
    const mappedKey = fieldMap[fieldKey] ?? fieldKey;
    acc[mappedKey] = filter;
    return acc;
  }, {} as Filters);
}

function buildNestedWhere(path: string, condition: Record<string, unknown>) {
  const parts = path.split(".").filter((part) => part.trim() !== "");
  if (parts.length === 0) return {};

  let result: Record<string, unknown> = { [parts[parts.length - 1]]: condition };
  for (let i = parts.length - 2; i >= 0; i -= 1) {
    result = { [parts[i]]: result };
  }

  return result;
}

function buildNestedOrderBy(path: string, sort: "asc" | "desc") {
  const parts = path.split(".").filter((part) => part.trim() !== "");
  if (parts.length === 0) return null;

  let result: Record<string, unknown> = { [parts[parts.length - 1]]: sort };
  for (let i = parts.length - 2; i >= 0; i -= 1) {
    result = { [parts[i]]: result };
  }

  return result;
}