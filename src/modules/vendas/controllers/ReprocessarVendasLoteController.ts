import { Request, Response } from "express";
import { z } from "zod";
import { ReprocessarVendasLoteService } from "@/modules/vendas/services/ReprocessarVendasLoteService";

const bodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).optional(),
  status: z.string().min(1).optional(),
});

export class ReprocessarVendasLoteController {
  handle = async (req: Request, res: Response) => {
    const ciaIds = req.user?.ciaIds || [];
    const params = bodySchema.parse(req.body);

    const service = new ReprocessarVendasLoteService();
    const result = await service.execute({ ...params, ciaIds });

    return res.status(202).json(result);
  };
}
