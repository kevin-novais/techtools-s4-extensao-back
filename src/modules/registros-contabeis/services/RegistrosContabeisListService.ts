import { AccountingDocumentItem } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import {
    formatDateOnly,
    parseDateForFilter,
    parseDateForFilterEnd,
} from "@/util/date";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
} from "@/util/filter";

export interface RegistrosContabeisListParams {
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    companyCode?: string;
    fiscalYear?: string;
    supplier?: string;
    customer?: string;
    accountingDocument?: string;
    glAccount?: string;
    idXrt?: string;
    dataInicio?: string;
    dataFim?: string;
}

interface RegistrosContabeisListItem {
    companyCode: string;
    fiscalYear: string;
    accountingDocument: string;
    accountingDocumentItem: string;
    postingDate: string | null;
    supplier: string | null;
    customer: string | null;
    documentReferenceID: string | null;
    glAccount: string | null;
    glAccountLongName: string | null;
    itemFluxoDeCaixa: string | null;
    idXrt: string | null;
    statusParaEnvio: string | null;
}

interface RegistrosContabeisListResponse {
    registrosContabeis: RegistrosContabeisListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

const FIELD_MAP: Record<string, string> = {
    companyCode: "CompanyCode",
    fiscalYear: "FiscalYear",
    accountingDocument: "AccountingDocument",
    accountingDocumentItem: "AccountingDocumentItem",
    postingDate: "PostingDate",
    supplier: "Supplier",
    customer: "Customer",
    documentReferenceID: "DocumentReferenceID",
    glAccount: "GLAccount",
    glAccountLongName: "GLAccountLongName",
    itemFluxoDeCaixa: "ItemFluxodeCaixa",
    idXrt: "IdXRT",
    statusParaEnvio: "StatusParaEnvio",
};

export class RegistrosContabeisListService {
    async execute(
        params: RegistrosContabeisListParams = {},
    ): Promise<RegistrosContabeisListResponse> {
        const {
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            companyCode,
            fiscalYear,
            supplier,
            customer,
            accountingDocument,
            glAccount,
            idXrt,
            dataInicio,
            dataFim,
        } = params;

        const baseWhere: Record<string, unknown> = {
            ...(companyCode ? { CompanyCode: { contains: companyCode } } : {}),
            ...(fiscalYear ? { FiscalYear: { contains: fiscalYear } } : {}),
            ...(supplier ? { Supplier: { contains: supplier } } : {}),
            ...(customer ? { Customer: { contains: customer } } : {}),
            ...(accountingDocument ? { AccountingDocument: { contains: accountingDocument } } : {}),
            ...(glAccount ? { GLAccount: { contains: glAccount } } : {}),
            ...(idXrt ? { IdXRT: { contains: idXrt } } : {}),
        };

        if (dataInicio) {
            baseWhere.PostingDate = { gte: parseDateForFilter(dataInicio) };
        }
        if (dataFim) {
            baseWhere.PostingDate = {
                ...(baseWhere.PostingDate as Record<string, unknown>),
                lte: parseDateForFilterEnd(dataFim),
            };
        }

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);

        const defaultOrderBy = [
            { CompanyCode: "asc" as const },
            { FiscalYear: "asc" as const },
            { AccountingDocument: "asc" as const },
            { AccountingDocumentItem: "asc" as const },
        ];
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, FIELD_MAP, defaultOrderBy);

        const skip = (page - 1) * limit;

        const [totalItems, registros] = await Promise.all([
            s4DotzClient.accountingDocumentItem.count({ where }),
            s4DotzClient.accountingDocumentItem.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = registros.map((item: AccountingDocumentItem) => ({
            companyCode: item.CompanyCode,
            fiscalYear: item.FiscalYear,
            accountingDocument: item.AccountingDocument,
            accountingDocumentItem: item.AccountingDocumentItem,
            postingDate: item.PostingDate == null ? null : formatDateOnly(item.PostingDate),
            supplier: item.Supplier ?? null,
            customer: item.Customer ?? null,
            documentReferenceID: item.DocumentReferenceID ?? null,
            glAccount: item.GLAccount ?? null,
            glAccountLongName: item.GLAccountLongName ?? null,
            itemFluxoDeCaixa: item.ItemFluxodeCaixa ?? null,
            idXrt: item.IdXRT ?? null,
            statusParaEnvio: item.StatusParaEnvio ?? null,
        }));

        return {
            registrosContabeis: formatted,
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
}
