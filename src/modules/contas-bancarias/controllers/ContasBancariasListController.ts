import { Request, Response } from "express";
import { z } from "zod";
import { ContasBancariasListService } from "@/modules/contas-bancarias/services/ContasBancariasListService";

const contasBancariasListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    houseBank: z.string().trim().max(10).optional(),
    houseBankAccount: z.string().trim().max(20).optional(),
    nomeBanco: z.string().trim().max(30).optional(),
    numeroBanco: z.string().trim().max(10).optional(),
    glAccount: z.string().trim().max(30).optional(),
});

export class ContasBancariasListController {
    async handle(req: Request, res: Response) {
        const query = contasBancariasListSchema.parse(req.query);

        const listService = new ContasBancariasListService();
        const result = await listService.execute(query);

        return res.status(200).json(result);
    }
}
