import { Request, Response } from "express";
import { z } from "zod";
import { DeduzirItemFluxoCaixaXtpgService } from "@/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService";
import { Config } from "@/config/config";

const bodySchema = z.object({
    limit: z.coerce.number().int().positive().max(5000).optional(),
});

export class ClassificacaoFluxoCaixaXtpgRunController {
    async handle(req: Request, res: Response) {
        const body = bodySchema.parse(req.body ?? {});
        const service = new DeduzirItemFluxoCaixaXtpgService();
        const limit = body.limit ?? Config.CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE;
        const result = await service.execute({ limit });
        return res.status(200).json({
            message: "Classificação XTPG executada",
            ...result,
        });
    }
}
