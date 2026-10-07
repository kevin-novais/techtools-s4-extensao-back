import { Request, Response } from "express";
import { z } from "zod";
import { ContasContabeisListService } from "@/modules/contas-contabeis/services/ContasContabeisListService";

const contasContabeisListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    chartOfAccounts: z.string().trim().max(10).optional(),
    companyCode: z.string().trim().max(10).optional(),
    glAccount: z.string().trim().max(30).optional(),
    glAccountName: z.string().trim().max(100).optional(),
    dataInicio: z.string().trim().optional(),
    dataFim: z.string().trim().optional(),
    xtpgAtivado: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
});

export class ContasContabeisListController {
    async handle(req: Request, res: Response) {
        const query = contasContabeisListSchema.parse(req.query);

        const listService = new ContasContabeisListService();
        const result = await listService.execute(query);

        return res.status(200).json(result);
    }
}
