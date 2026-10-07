import { Request, Response } from "express";
import { ContasContabeisExportService } from "@/modules/contas-contabeis/services/ContasContabeisExportService";

export class ContasContabeisExportController {
    async handle(req: Request, res: Response) {
        const { chartOfAccounts, companyCode, glAccount, glAccountName, dataInicio, dataFim, xtpgAtivado } =
            req.query;

        const xtpgAtivadoParsed =
            xtpgAtivado === "true" ? true : xtpgAtivado === "false" ? false : undefined;

        const exportService = new ContasContabeisExportService();
        const buffer = await exportService.execute({
            chartOfAccounts: chartOfAccounts as string | undefined,
            companyCode: companyCode as string | undefined,
            glAccount: glAccount as string | undefined,
            glAccountName: glAccountName as string | undefined,
            dataInicio: dataInicio as string | undefined,
            dataFim: dataFim as string | undefined,
            xtpgAtivado: xtpgAtivadoParsed,
        });

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="contas-contabeis-export.xlsx"'
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.send(buffer);
    }
}
