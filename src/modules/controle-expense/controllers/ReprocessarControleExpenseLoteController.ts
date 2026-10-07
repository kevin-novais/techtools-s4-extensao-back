import { Request, Response } from "express";
import { z } from "zod";
import { ReprocessarControleExpenseLoteService } from "@/modules/controle-expense/services/ReprocessarControleExpenseLoteService";

const bodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).optional(),
  status: z.string().min(1).optional(),
});

export class ReprocessarControleExpenseLoteController {
  async handle(req: Request, res: Response) {
    const params = bodySchema.parse(req.body);
    const service = new ReprocessarControleExpenseLoteService();
    const result = await service.execute(params);
    return res.status(202).json(result);
  }
}
