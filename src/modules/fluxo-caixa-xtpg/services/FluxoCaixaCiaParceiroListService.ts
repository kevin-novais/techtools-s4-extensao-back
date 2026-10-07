import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatFluxoCaixaCiaParceiro } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
    parseAgGridFilterModel,
    parseAgGridSortModel,
} from "@/util/filter";

interface FluxoCaixaCiaParceiroListParams {
    cardCode?: string;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
}

const FIELD_MAP: Record<string, string> = {
    cardCode: "cardCode",
    companyCode: "companyCode",
    itemFluxoCaixa: "itemFluxoCaixa",
};
const ALLOWED_FIELDS = new Set(Object.keys(FIELD_MAP));

export class FluxoCaixaCiaParceiroListService {
    async execute(params: FluxoCaixaCiaParceiroListParams) {
        const { cardCode, page = 1, limit = 10, filterModel, sortModel } = params;
        const cardTrimmed = cardCode?.trim();

        const skip = (page - 1) * limit;

        const baseWhere = cardTrimmed ? { cardCode: cardTrimmed } : {};
        const sanitizedFilterModel = this.sanitizeFilterModel(filterModel);
        const sanitizedSortModel = this.sanitizeSortModel(sortModel);
        const agGridWhere = agGridFilterModelToPrismaWhere(sanitizedFilterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const defaultOrderBy = [{ companyCode: "asc" as const }, { itemFluxoCaixa: "asc" as const }];
        const orderBy = agGridSortModelToPrismaOrderBy(sanitizedSortModel, {}, FIELD_MAP, defaultOrderBy);

        const [totalItems, rows] = await Promise.all([
            s4DotzClient.fluxoCaixaCiaParceiro.count({ where }),
            s4DotzClient.fluxoCaixaCiaParceiro.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            vinculos: rows.map(formatFluxoCaixaCiaParceiro),
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
