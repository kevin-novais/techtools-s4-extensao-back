import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalhePontoShowService } from "@/modules/configuracao-contabil/services/pontos/ConfiguracaoContabilDetalhePontoShowService";

const configuracaoContabilDetalhePontoShowParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    pontoId: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilDetalhePontoShowController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, pontoId } = configuracaoContabilDetalhePontoShowParamsSchema.parse(req.params);

        const showService = new ConfiguracaoContabilDetalhePontoShowService();
        const ponto = await showService.execute({
            configuracaoContabilId,
            pontoId,
        });

        return res.status(200).json(ponto);
    }
}
