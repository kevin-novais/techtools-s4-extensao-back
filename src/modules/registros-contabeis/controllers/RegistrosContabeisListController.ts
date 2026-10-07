import { Request, Response } from "express";
import { z } from "zod";
import { RegistrosContabeisListService } from "@/modules/registros-contabeis/services/RegistrosContabeisListService";

const registrosContabeisListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    companyCode: z.string().trim().max(4).optional(),
    fiscalYear: z.string().trim().max(4).optional(),
    supplier: z.string().trim().max(10).optional(),
    customer: z.string().trim().max(10).optional(),
    accountingDocument: z.string().trim().max(10).optional(),
    glAccount: z.string().trim().max(10).optional(),
    idXrt: z.string().trim().max(50).optional(),
    dataInicio: z.string().trim().optional(),
    dataFim: z.string().trim().optional(),
});

export class RegistrosContabeisListController {
    async handle(req: Request, res: Response) {
        const query = registrosContabeisListSchema.parse(req.query);

        const listService = new RegistrosContabeisListService();
        const result = await listService.execute(query);

        return res.status(200).json(result);
    }
}
