import { Request, Response } from "express";
import { z } from "zod";
import { VendasDeleteService } from "@/modules/vendas/services/VendasDeleteService";

const vendasDeleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasDeleteController {
    async handle(req: Request, res: Response) {
        const { id } = vendasDeleteParamsSchema.parse(req.params);
        const ciaIds = req.user?.ciaIds ?? [];

        const service = new VendasDeleteService();
        const result = await service.execute({ id, ciaIds });

        return res.status(200).json(result);
    }
}
