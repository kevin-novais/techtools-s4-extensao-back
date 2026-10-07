import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilShowService } from "@/modules/configuracao-contabil/services/ConfiguracaoContabilShowService";

const configuracaoContabilShowParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilShowController {
    async handle(req: Request, res: Response) {
        const { id } = configuracaoContabilShowParamsSchema.parse(req.params);

        const showService = new ConfiguracaoContabilShowService();
        const configuracao = await showService.execute(id);

        return res.status(200).json(configuracao);
    }
}


