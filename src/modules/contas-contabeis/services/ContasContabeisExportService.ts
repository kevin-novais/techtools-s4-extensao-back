import * as XLSX from "xlsx";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import * as dateUtil from "@/util/date";

const EXPORT_LIMIT = 10_000;

interface ContasContabeisExportParams {
    chartOfAccounts?: string;
    companyCode?: string;
    glAccount?: string;
    glAccountName?: string;
    dataInicio?: string;
    dataFim?: string;
    xtpgAtivado?: boolean;
}

export class ContasContabeisExportService {
    async execute(params: ContasContabeisExportParams = {}): Promise<Buffer> {
        const { chartOfAccounts, companyCode, glAccount, glAccountName, dataInicio, dataFim, xtpgAtivado } =
            params;

        const baseWhere: Record<string, unknown> = {
            ...(chartOfAccounts ? { ChartOfAccounts: { contains: chartOfAccounts } } : {}),
            ...(companyCode ? { CompanyCode: { contains: companyCode } } : {}),
            ...(glAccount ? { GLAccount: { contains: glAccount } } : {}),
            ...(glAccountName ? { GLAccountName: { contains: glAccountName } } : {}),
            ...(xtpgAtivado === undefined ? {} : { XtpgAtivado: xtpgAtivado }),
        };

        if (dataInicio) {
            baseWhere.DataInicio = { gte: dateUtil.parseDateForFilter(dataInicio) };
        }
        if (dataFim) {
            baseWhere.DataFim = { lte: dateUtil.parseDateForFilterEnd(dataFim) };
        }

        const contasContabeis = await s4DotzClient.contasContabeis.findMany({
            where: baseWhere,
            orderBy: [
                { ChartOfAccounts: "asc" },
                { CompanyCode: "asc" },
                { GLAccount: "asc" },
            ],
            take: EXPORT_LIMIT + 1,
        });

        if (contasContabeis.length > EXPORT_LIMIT) {
            throw new AppError(
                `Exportação limitada a ${EXPORT_LIMIT} registros. Use filtros para reduzir o resultado.`,
                400
            );
        }

        const rows = this.buildRows(contasContabeis);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Contas Contábeis");

        return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    }

    private buildRows(
        contas: Array<{
            ChartOfAccounts: string;
            CompanyCode: string;
            GLAccount: string;
            GLAccountName: string;
            GLAccountECD: string | null;
            GLAccountCosif: string | null;
            GLContaPaiCosif: string | null;
            ItemFluxoDeCaixa: string | null;
            GlAccountB1Xtpg: string | null;
            XtpgAtivado: boolean | null;
            DataInicio: Date | null;
            DataFim: Date | null;
        }>
    ): (string | null)[][] {
        const header = [
            "chartOfAccounts",
            "companyCode",
            "glAccount",
            "glAccountName",
            "glAccountECD",
            "glAccountCosif",
            "glContaPaiCosif",
            "itemFluxoDeCaixa",
            "glAccountB1Xtpg",
            "xtpgAtivado",
            "dataInicio",
            "dataFim",
        ];
        const rows: (string | null)[][] = [header];

        for (const c of contas) {
            rows.push([
                c.ChartOfAccounts,
                c.CompanyCode,
                c.GLAccount,
                c.GLAccountName,
                c.GLAccountECD ?? "",
                c.GLAccountCosif ?? "",
                c.GLContaPaiCosif ?? "",
                c.ItemFluxoDeCaixa ?? "",
                c.GlAccountB1Xtpg ?? "",
                c.XtpgAtivado ? "true" : "false",
                c.DataInicio == null ? "" : dateUtil.formatDateOnly(c.DataInicio),
                c.DataFim == null ? "" : dateUtil.formatDateOnly(c.DataFim),
            ]);
        }

        return rows;
    }
}
