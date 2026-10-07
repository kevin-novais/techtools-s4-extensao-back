import { Request, Response } from "express";
import { z } from "zod";
import { ControleExpenseShowService } from "@/modules/controle-expense/services/ControleExpenseShowService";

const controleExpenseShowParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class ControleExpenseShowController {
    async handle(req: Request, res: Response) {
        const params = controleExpenseShowParamsSchema.parse(req.params);

        const showService = new ControleExpenseShowService();
        const controleExpense = await showService.execute(params);

        return res.status(200).json(controleExpense);
    }
}
