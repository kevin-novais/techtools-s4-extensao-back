import { Request, Response } from "express";
import { z } from "zod";
import { VendasShowService } from "@/modules/vendas/services/VendasShowService";

const vendasShowParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasShowController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id } = vendasShowParamsSchema.parse(req.params);

        const vendasShowService = new VendasShowService();
        const venda = await vendasShowService.execute(id, ciaIds);

        return res.status(200).json(venda);
    }
}
