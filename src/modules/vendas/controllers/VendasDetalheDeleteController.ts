import { Request, Response } from "express";
import { z } from "zod";
import { VendasDetalheDeleteService } from "@/modules/vendas/services/VendasDetalheDeleteService";

const vendasDetalheDeleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

export class VendasDetalheDeleteController {
    async handle(req: Request, res: Response) {
        const { id: vendasHeaderId, detalheId } = vendasDetalheDeleteParamsSchema.parse(
            req.params,
        );
        const ciaIds = req.user?.ciaIds ?? [];

        const service = new VendasDetalheDeleteService();
        const result = await service.execute({
            vendasHeaderId,
            detalheId,
            ciaIds,
        });

        return res.status(200).json(result);
    }
}
