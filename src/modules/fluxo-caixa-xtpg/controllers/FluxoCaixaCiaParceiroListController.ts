import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaParceiroListService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroListService";

const querySchema = z.object({
    cardCode: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().max(5000).optional(),
    sortModel: z.string().trim().max(5000).optional(),
});

export class FluxoCaixaCiaParceiroListController {
    async handle(req: Request, res: Response) {
        const query = querySchema.parse(req.query);
        const service = new FluxoCaixaCiaParceiroListService();
        const result = await service.execute(query);
        return res.status(200).json(result);
    }
}
