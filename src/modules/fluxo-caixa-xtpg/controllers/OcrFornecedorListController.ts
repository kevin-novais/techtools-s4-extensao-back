import { Request, Response } from "express";
import { z } from "zod";
import { OcrFornecedorListService } from "@/modules/fluxo-caixa-xtpg/services/OcrFornecedorListService";

const querySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    search: z.string().trim().max(120).optional(),
    filterModel: z.string().trim().max(5000).optional(),
    sortModel: z.string().trim().max(5000).optional(),
});

export class OcrFornecedorListController {
    async handle(req: Request, res: Response) {
        const query = querySchema.parse(req.query);
        const service = new OcrFornecedorListService();
        const result = await service.execute(query);
        return res.status(200).json(result);
    }
}
