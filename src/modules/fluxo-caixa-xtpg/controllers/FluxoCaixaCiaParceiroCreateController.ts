import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaParceiroCreateService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroCreateService";

const bodySchema = z.object({
    cardCode: z.string().trim().min(1),
    companyCode: z.string(),
    itemFluxoCaixa: z.string().trim().min(1).max(20),
    validateOcrExists: z.boolean().optional(),
});

export class FluxoCaixaCiaParceiroCreateController {
    async handle(req: Request, res: Response) {
        const body = bodySchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const service = new FluxoCaixaCiaParceiroCreateService();
        const result = await service.execute({
            ...body,
            usuarioId,
        });

        return res.status(201).json({
            message: "Vínculo criado com sucesso",
            vinculo: result,
        });
    }
}
