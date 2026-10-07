import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalhePontoDeleteService } from "@/modules/configuracao-contabil/services/pontos/ConfiguracaoContabilDetalhePontoDeleteService";

const configuracaoContabilDetalhePontoDeleteParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    pontoId: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilDetalhePontoDeleteController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, pontoId } = configuracaoContabilDetalhePontoDeleteParamsSchema.parse(req.params);

        const deleteService = new ConfiguracaoContabilDetalhePontoDeleteService();
        const result = await deleteService.execute({
            configuracaoContabilId,
            pontoId,
        });

        return res.status(200).json(result);
    }
}
