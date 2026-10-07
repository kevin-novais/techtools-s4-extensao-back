import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaParceiroDeleteService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroDeleteService";

const querySchema = z.object({
    cardCode: z.string().trim().min(1),
    companyCode: z.string().optional().default(""),
});

export class FluxoCaixaCiaParceiroDeleteController {
    async handle(req: Request, res: Response) {
        const { cardCode, companyCode } = querySchema.parse(req.query);
        const service = new FluxoCaixaCiaParceiroDeleteService();
        const result = await service.execute({ cardCode, companyCode });
        return res.status(200).json(result);
    }
}
