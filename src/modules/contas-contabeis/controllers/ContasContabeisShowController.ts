import { Request, Response } from "express";
import { z } from "zod";
import { ContasContabeisShowService } from "@/modules/contas-contabeis/services/ContasContabeisShowService";

const contasContabeisShowParamsSchema = z.object({
    chartOfAccounts: z.string().trim().min(1, "chartOfAccounts é obrigatório"),
    companyCode: z.string().trim().min(1, "companyCode é obrigatório"),
    glAccount: z.string().trim().min(1, "glAccount é obrigatório"),
});

export class ContasContabeisShowController {
    async handle(req: Request, res: Response) {
        const params = contasContabeisShowParamsSchema.parse(req.params);

        const showService = new ContasContabeisShowService();
        const conta = await showService.execute(params);

        return res.status(200).json(conta);
    }
}
