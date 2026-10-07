import dotzStageClient from "@/database/clients/dotzStageClient";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
    parseAgGridFilterModel,
    parseAgGridSortModel,
} from "@/util/filter";

interface OcrFornecedorListParams {
    page?: number;
    limit?: number;
    search?: string;
    filterModel?: string;
    sortModel?: string;
}

const FIELD_MAP: Record<string, string> = {
    cardCode: "CardCode",
    uCodDotz: "U_CODDOTZ",
    cardName: "CardName",
    cnpj: "cnpj",
};
const ALLOWED_FIELDS = new Set(Object.keys(FIELD_MAP));

export class OcrFornecedorListService {
    async execute(params: OcrFornecedorListParams = {}) {
        const { page = 1, limit = 10, search, filterModel, sortModel } = params;
        const searchTrimmed = search?.trim();

        const cnpjDigits = searchTrimmed?.replaceAll(/\D/g, "") ?? "";
        const baseWhere = {
            ativo: true,
            ...(searchTrimmed
                ? {
                      OR: [
                          { CardCode: { contains: searchTrimmed } },
                          { CardName: { contains: searchTrimmed } },
                          ...(cnpjDigits.length >= 8 ? [{ cnpj: { contains: cnpjDigits } }] : []),
                      ],
                  }
                : {}),
        };
        const sanitizedFilterModel = this.sanitizeFilterModel(filterModel);
        const sanitizedSortModel = this.sanitizeSortModel(sortModel);
        const agGridWhere = agGridFilterModelToPrismaWhere(sanitizedFilterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sanitizedSortModel, {}, FIELD_MAP, { CardCode: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, rows] = await Promise.all([
            dotzStageClient().oCRD.count({ where }),
            dotzStageClient().oCRD.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            fornecedores: rows,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    private sanitizeFilterModel(filterModel?: string) {
        const parsed = parseAgGridFilterModel(filterModel);
        if (!parsed) return undefined;

        const sanitized = Object.entries(parsed).reduce<Record<string, unknown>>((acc, [key, value]) => {
            if (!ALLOWED_FIELDS.has(key)) return acc;
            acc[key] = value;
            return acc;
        }, {});

        if (Object.keys(sanitized).length === 0) return undefined;
        return JSON.stringify(sanitized);
    }

    private sanitizeSortModel(sortModel?: string) {
        const parsed = parseAgGridSortModel(sortModel);
        if (!parsed) return undefined;

        const sanitized = parsed.filter((item) => ALLOWED_FIELDS.has(item.colId));
        if (sanitized.length === 0) return undefined;

        return JSON.stringify(sanitized);
    }
}
