import { Request, Response } from "express";
import { z } from "zod";
import { VendasProcessarService } from "@/modules/vendas/services/VendasProcessarService";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasProcessarController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);
        const ciaIds = req.user?.ciaIds ?? [];
        const venda = await new VendasProcessarService().execute({ id, ciaIds });

        return res.status(200).json({
            message: "Venda encaminhada para processamento",
            venda,
        });
    }
}
