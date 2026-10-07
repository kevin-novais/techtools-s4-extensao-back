import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatFluxoCaixaCiaTipoLancamento } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
    parseAgGridFilterModel,
    parseAgGridSortModel,
} from "@/util/filter";

interface FluxoCaixaCiaTipoLancamentoListParams {
    page?: number;
    limit?: number;
    companyCode?: string;
    postingKey?: string;
    documentType?: string;
    filterModel?: string;
    sortModel?: string;
}

const FIELD_MAP: Record<string, string> = {
    companyCode: "companyCode",
    postingKey: "postingKey",
    documentType: "documentType",
    referenceDocumentType: "referenceDocumentType",
    isReversed: "isReversed",
    reversalReason: "reversalReason",
    debitCreditCode: "debitCreditCode",
    itemFluxoCaixa: "itemFluxoCaixa",
};
const ALLOWED_FIELDS = new Set(Object.keys(FIELD_MAP));

export class FluxoCaixaCiaTipoLancamentoListService {
    async execute(params: FluxoCaixaCiaTipoLancamentoListParams = {}) {
        const {
            page = 1,
            limit = 10,
            companyCode,
            postingKey,
            documentType,
            filterModel,
            sortModel,
        } = params;
        const normalizedCompanyCode = companyCode?.trim();

        const baseWhere: Record<string, unknown> = {
            ...(normalizedCompanyCode === undefined || normalizedCompanyCode === ""
                ? {}
                : { companyCode: normalizeXtpgCompanyCode(normalizedCompanyCode) }),
            ...(postingKey?.trim() ? { postingKey: { contains: postingKey.trim() } } : {}),
            ...(documentType?.trim() ? { documentType: { contains: documentType.trim() } } : {}),
        };
        const sanitizedFilterModel = this.sanitizeFilterModel(filterModel);
        const sanitizedSortModel = this.sanitizeSortModel(sortModel);
        const agGridWhere = agGridFilterModelToPrismaWhere(sanitizedFilterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);

        const skip = (page - 1) * limit;
        const defaultOrderBy = [
            { companyCode: "asc" as const },
            { postingKey: "asc" as const },
            { documentType: "asc" as const },
        ];
        const orderBy = agGridSortModelToPrismaOrderBy(sanitizedSortModel, {}, FIELD_MAP, defaultOrderBy);

        const [totalItems, rows] = await Promise.all([
            s4DotzClient.fluxoCaixaCiaTipoLancamento.count({ where }),
            s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            parametros: rows.map(formatFluxoCaixaCiaTipoLancamento),
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
