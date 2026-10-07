import { Request, Response } from "express";
import { z } from "zod";
import { ReprocessarControleExpenseService } from "@/modules/controle-expense/services/ReprocessarControleExpenseService";

const reprocessarParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class ReprocessarControleExpenseController {
    async handle(req: Request, res: Response) {
        const params = reprocessarParamsSchema.parse(req.params);

        const service = new ReprocessarControleExpenseService();
        const result = await service.execute(params);

        return res.status(202).json({
            message: "Reprocessamento enfileirado",
            reportId: result.reportId,
        });
    }
}
