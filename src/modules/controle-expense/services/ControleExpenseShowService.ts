import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import { ControleExpenseResponseItem } from "@/modules/controle-expense/services/ControleExpenseListService";

interface ControleExpenseShowParams {
    id: number;
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
    request: true,
    response: true,
    nomeColaborador: true,
    valorDocumento: true,
    dataImportacao: true,
    dataIntegracaoPagamento: true,
    dataAprovacao: true,
    criadoEm: true,
    atualizadoEm: true,
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
    request: string | null;
    response: string | null;
    nomeColaborador: string | null;
    valorDocumento: unknown;
    dataImportacao: Date | null;
    dataIntegracaoPagamento: Date | null;
    dataAprovacao: Date | null;
    criadoEm: Date;
    atualizadoEm: Date;
};

export class ControleExpenseShowService {
    async execute({ id }: ControleExpenseShowParams): Promise<ControleExpenseResponseItem> {
        const controleExpense = await s4DotzClient.controleExpense.findUnique({
            where: { id },
            select: CONTROLE_EXPENSE_SELECT,
        });

        if (!controleExpense) {
            throw new AppError("Controle de despesa não encontrado", 404);
        }

        return this.formatControleExpense(controleExpense as ControleExpenseSelected);
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
            request: item.request,
            response: item.response,
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
