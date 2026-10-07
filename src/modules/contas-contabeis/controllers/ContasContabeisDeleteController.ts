import { Request, Response } from "express";
import { z } from "zod";
import { ContasContabeisDeleteService } from "@/modules/contas-contabeis/services/ContasContabeisDeleteService";

const contasContabeisDeleteParamsSchema = z.object({
    chartOfAccounts: z.string().trim().min(1, "chartOfAccounts é obrigatório"),
    companyCode: z.string().trim().min(1, "companyCode é obrigatório"),
    glAccount: z.string().trim().min(1, "glAccount é obrigatório"),
});

export class ContasContabeisDeleteController {
    async handle(req: Request, res: Response) {
        const params = contasContabeisDeleteParamsSchema.parse(req.params);

        const deleteService = new ContasContabeisDeleteService();
        const result = await deleteService.execute(params);

        return res.status(200).json(result);
    }
}
