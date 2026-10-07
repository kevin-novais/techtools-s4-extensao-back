import { Request, Response } from "express";
import { z } from "zod";
import { VendasDetalheShowService } from "@/modules/vendas/services/VendasDetalheShowService";

const vendasDetalheShowParamsSchema = z.object({
    headerId: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

export class VendasDetalheShowController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { detalheId } = vendasDetalheShowParamsSchema.parse(req.params);

        const vendasDetalheShowService = new VendasDetalheShowService();
        const detalhe = await vendasDetalheShowService.execute(detalheId, ciaIds);

        return res.status(200).json(detalhe);
    }
}
