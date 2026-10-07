import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalheShowService } from "@/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheShowService";

const configuracaoContabilDetalheShowParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilDetalheShowController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, detalheId } = configuracaoContabilDetalheShowParamsSchema.parse(req.params);

        const showService = new ConfiguracaoContabilDetalheShowService();
        const detalhe = await showService.execute({
            configuracaoContabilId,
            detalheId,
        });

        return res.status(200).json(detalhe);
    }
}

