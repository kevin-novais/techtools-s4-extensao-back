import { ContasContabeis } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import {
    formatDateOnly,
    formatDateToBrazilianTimezone,
    parseDateForFilter,
    parseDateForFilterEnd,
} from "@/util/date";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
} from "@/util/filter";

interface ContasContabeisListParams {
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    chartOfAccounts?: string;
    companyCode?: string;
    glAccount?: string;
    glAccountName?: string;
    dataInicio?: string;
    dataFim?: string;
    xtpgAtivado?: boolean;
}

interface ContasContabeisListItem {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
    glAccountName: string;
    glAccountECD: string | null;
    glAccountCosif: string | null;
    glContaPaiCosif: string | null;
    itemFluxoDeCaixa: string;
    glAccountB1Xtpg: string | null;
    xtpgAtivado: boolean;
    centroCusto: string | null;
    centroLucro: string | null;
    dataInicio: string | null;
    dataAlteracao: string | null;
    dataFim: string | null;
}

interface ContasContabeisListResponse {
    contasContabeis: ContasContabeisListItem[];
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
    chartOfAccounts: "ChartOfAccounts",
    companyCode: "CompanyCode",
    glAccount: "GLAccount",
    glAccountName: "GLAccountName",
    glAccountECD: "GLAccountECD",
    glAccountCosif: "GLAccountCosif",
    glContaPaiCosif: "GLContaPaiCosif",
    itemFluxoDeCaixa: "ItemFluxoDeCaixa",
    glAccountB1Xtpg: "GlAccountB1Xtpg",
    xtpgAtivado: "XtpgAtivado",
    centroCusto: "CentroCusto",
    centroLucro: "CentroLucro",
    dataInicio: "DataInicio",
    dataAlteracao: "DataAlteracao",
    dataFim: "DataFim",
};

export class ContasContabeisListService {
    async execute(params: ContasContabeisListParams = {}): Promise<ContasContabeisListResponse> {
        const {
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            chartOfAccounts,
            companyCode,
            glAccount,
            glAccountName,
            dataInicio,
            dataFim,
            xtpgAtivado,
        } = params;

        const baseWhere: Record<string, unknown> = {
            ...(chartOfAccounts ? { ChartOfAccounts: { contains: chartOfAccounts } } : {}),
            ...(companyCode ? { CompanyCode: { contains: companyCode } } : {}),
            ...(glAccount ? { GLAccount: { contains: glAccount } } : {}),
            ...(glAccountName ? { GLAccountName: { contains: glAccountName } } : {}),
            ...(xtpgAtivado === undefined ? {} : { XtpgAtivado: xtpgAtivado }),
        };

        if (dataInicio) {
            baseWhere.DataInicio = { gte: parseDateForFilter(dataInicio) };
        }
        if (dataFim) {
            baseWhere.DataFim = { lte: parseDateForFilterEnd(dataFim) };
        }

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const defaultOrderBy = [
            { ChartOfAccounts: "asc" as const },
            { CompanyCode: "asc" as const },
            { GLAccount: "asc" as const },
        ];
        const orderBy = agGridSortModelToPrismaOrderBy(
            sortModel,
            {},
            FIELD_MAP,
            defaultOrderBy
        );

        const skip = (page - 1) * limit;

        const [totalItems, contasContabeis] = await Promise.all([
            s4DotzClient.contasContabeis.count({ where }),
            s4DotzClient.contasContabeis.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = contasContabeis.map((item: ContasContabeis) => ({
            chartOfAccounts: item.ChartOfAccounts,
            companyCode: item.CompanyCode,
            glAccount: item.GLAccount,
            glAccountName: item.GLAccountName,
            glAccountECD: item.GLAccountECD ?? null,
            glAccountCosif: item.GLAccountCosif ?? null,
            glContaPaiCosif: item.GLContaPaiCosif ?? null,
            itemFluxoDeCaixa: item.ItemFluxoDeCaixa,
            glAccountB1Xtpg: item.GlAccountB1Xtpg ?? null,
            xtpgAtivado: item.XtpgAtivado,
            centroCusto: item.CentroCusto ?? null,
            centroLucro: item.CentroLucro ?? null,
            dataInicio: item.DataInicio == null ? null : formatDateOnly(item.DataInicio),
            dataAlteracao: item.DataAlteracao == null ? null : formatDateToBrazilianTimezone(item.DataAlteracao),
            dataFim: item.DataFim == null ? null : formatDateOnly(item.DataFim),
        }));

        return {
            contasContabeis: formatted,
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
