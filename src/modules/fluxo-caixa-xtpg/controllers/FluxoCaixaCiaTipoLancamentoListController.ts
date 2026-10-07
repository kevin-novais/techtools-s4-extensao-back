import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaTipoLancamentoListService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoListService";

const querySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    companyCode: z.string().trim().max(10).optional(),
    postingKey: z.string().trim().max(10).optional(),
    documentType: z.string().trim().max(20).optional(),
    filterModel: z.string().trim().max(5000).optional(),
    sortModel: z.string().trim().max(5000).optional(),
});

export class FluxoCaixaCiaTipoLancamentoListController {
    async handle(req: Request, res: Response) {
        const query = querySchema.parse(req.query);
        const service = new FluxoCaixaCiaTipoLancamentoListService();
        const result = await service.execute(query);
        return res.status(200).json(result);
    }
}
