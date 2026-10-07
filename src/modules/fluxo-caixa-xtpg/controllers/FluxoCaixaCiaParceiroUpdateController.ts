import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaParceiroUpdateService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroUpdateService";

const bodySchema = z.object({
    cardCode: z.string().trim().min(1),
    companyCode: z.string().optional().default(""),
    itemFluxoCaixa: z.string().trim().min(1).max(20),
});

export class FluxoCaixaCiaParceiroUpdateController {
    async handle(req: Request, res: Response) {
        const { cardCode, companyCode, itemFluxoCaixa } = bodySchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const service = new FluxoCaixaCiaParceiroUpdateService();
        const result = await service.execute({
            cardCode,
            companyCode,
            itemFluxoCaixa,
            usuarioId,
        });

        return res.status(200).json({
            message: "Vínculo atualizado com sucesso",
            vinculo: result,
        });
    }
}
