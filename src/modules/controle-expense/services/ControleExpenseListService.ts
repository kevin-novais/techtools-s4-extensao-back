import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
} from "@/util/filter";

export const CONTROLE_EXPENSE_STATUSES = [
    "PENDENTE",
    "INTEGRADO_SAP",
    "INTEGRADO_VEXPENSES",
    "ERRO_INTEGRACAO_SAP",
    "ERRO_INTEGRACAO_VEXPENSES",
    "DESCARTADO",
] as const;

export type ControleExpenseStatus = (typeof CONTROLE_EXPENSE_STATUSES)[number];

interface ControleExpenseListParams {
    page?: number;
    pageSize?: number;
    status?: ControleExpenseStatus;
    reportId?: number;
    codigoProtocoloVexpenses?: string;
    codigoDocumentoERP?: string;
    dataAprovacaoInicio?: Date;
    dataAprovacaoFim?: Date;
    dataImportacaoInicio?: Date;
    dataImportacaoFim?: Date;
    filterModel?: string;
    sortModel?: string;
}

interface DateRangeFilter {
    gte?: Date;
    lte?: Date;
}

export interface ControleExpenseResponseItem {
    id: number;
    reportId: number;
    paying_company_id: number | null;
    status: string;
    codigoCia: string | null;
    fiscalYear: string | null;
    codigoDocumentoERP: string | null;
    codigoSapColaborador: string | null;
    codigoProtocoloVexpenses: string | null;
    error_message: string | null;
    request: string | null;
    response: string | null;
    nomeColaborador: string | null;
    valorDocumento: number | null;
    dataImportacao: string;
    dataIntegracaoPagamento: string;
    dataAprovacao: string;
    criadoEm: string;
    atualizadoEm: string;
}

interface ControleExpenseListResponse {
    controleExpenses: ControleExpenseResponseItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

const CONTROLE_EXPENSE_SELECT = {
    id: true,
    reportId: true,
    paying_company_id: true,
    status: true,
    codigoCia: true,
    fiscalYear: true,
    codigoDocumentoERP: true,
    codigoSapColaborador: true,
    codigoProtocoloVexpenses: true,
    error_message: true,
    nomeColaborador: true,
    valorDocumento: true,
    dataImportacao: true,
    dataIntegracaoPagamento: true,
    dataAprovacao: true,
    criadoEm: true,
    atualizadoEm: true,
};

const FIELD_MAP: Record<string, string> = {
    id: "id",
    reportId: "reportId",
    paying_company_id: "paying_company_id",
    status: "status",
    codigoCia: "codigoCia",
    fiscalYear: "fiscalYear",
    codigoDocumentoERP: "codigoDocumentoERP",
    codigoSapColaborador: "codigoSapColaborador",
    codigoProtocoloVexpenses: "codigoProtocoloVexpenses",
    error_message: "error_message",
    nomeColaborador: "nomeColaborador",
    valorDocumento: "valorDocumento",
    dataImportacao: "dataImportacao",
    dataIntegracaoPagamento: "dataIntegracaoPagamento",
    dataAprovacao: "dataAprovacao",
    criadoEm: "criadoEm",
    atualizadoEm: "atualizadoEm",
};

type ControleExpenseSelected = {
    id: number;
    reportId: number;
    paying_company_id: number | null;
    status: string;
    codigoCia: string | null;
    fiscalYear: string | null;
    codigoDocumentoERP: string | null;
    codigoSapColaborador: string | null;
    codigoProtocoloVexpenses: string | null;
    error_message: string | null;
    nomeColaborador: string | null;
    valorDocumento: unknown;
    dataImportacao: Date | null;
    dataIntegracaoPagamento: Date | null;
    dataAprovacao: Date | null;
    criadoEm: Date;
    atualizadoEm: Date;
};

export class ControleExpenseListService {
    async execute(params: ControleExpenseListParams = {}): Promise<ControleExpenseListResponse> {
        const {
            page = 1,
            pageSize = 10,
            status,
            reportId,
            codigoProtocoloVexpenses,
            codigoDocumentoERP,
            dataAprovacaoInicio,
            dataAprovacaoFim,
            dataImportacaoInicio,
            dataImportacaoFim,
            filterModel,
            sortModel,
        } = params;

        const baseWhere: Record<string, unknown> = {
            ...(status ? { status } : {}),
            ...(reportId ? { reportId } : {}),
            ...(codigoProtocoloVexpenses
                ? { codigoProtocoloVexpenses: { contains: codigoProtocoloVexpenses } }
                : {}),
            ...(codigoDocumentoERP ? { codigoDocumentoERP: { contains: codigoDocumentoERP } } : {}),
        };

        const dataAprovacao = this.buildDateRange(dataAprovacaoInicio, dataAprovacaoFim);
        const dataImportacao = this.buildDateRange(dataImportacaoInicio, dataImportacaoFim);

        if (dataAprovacao) {
            baseWhere.dataAprovacao = dataAprovacao;
        }

        if (dataImportacao) {
            baseWhere.dataImportacao = dataImportacao;
        }

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(
            sortModel,
            {},
            FIELD_MAP,
            { id: "desc" }
        );
        const skip = (page - 1) * pageSize;

        const [totalItems, controleExpenses] = await Promise.all([
            s4DotzClient.controleExpense.count({ where }),
            s4DotzClient.controleExpense.findMany({
                where,
                select: CONTROLE_EXPENSE_SELECT,
                orderBy,
                skip,
                take: pageSize,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / pageSize);

        return {
            controleExpenses: (controleExpenses as ControleExpenseSelected[]).map((item) =>
                this.formatControleExpense(item as ControleExpenseSelected)
            ),
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: pageSize,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    private buildDateRange(start?: Date, end?: Date): DateRangeFilter | null {
        const range: DateRangeFilter = {};

        if (start) {
            range.gte = start;
        }

        if (end) {
            range.lte = end;
        }

        if (!range.gte && !range.lte) {
            return null;
        }

        return range;
    }

    private formatControleExpense(item: ControleExpenseSelected): ControleExpenseResponseItem {
        return {
            id: item.id,
            reportId: item.reportId,
            paying_company_id: item.paying_company_id,
            status: item.status,
            codigoCia: item.codigoCia,
            fiscalYear: item.fiscalYear,
            codigoDocumentoERP: item.codigoDocumentoERP,
            codigoSapColaborador: item.codigoSapColaborador,
            codigoProtocoloVexpenses: item.codigoProtocoloVexpenses,
            error_message: item.error_message,
            request: null,
            response: null,
            nomeColaborador: item.nomeColaborador,
            valorDocumento: item.valorDocumento != null ? Number(item.valorDocumento) : null,
            dataImportacao: formatDateToBrazilianTimezone(item.dataImportacao),
            dataIntegracaoPagamento: formatDateToBrazilianTimezone(item.dataIntegracaoPagamento),
            dataAprovacao: formatDateOnly(item.dataAprovacao),
            criadoEm: formatDateToBrazilianTimezone(item.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(item.atualizadoEm),
        };
    }
}
