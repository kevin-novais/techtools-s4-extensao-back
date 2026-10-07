import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalheDeleteService } from "@/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheDeleteService";

const configuracaoContabilDetalheDeleteParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilDetalheDeleteController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, detalheId } = configuracaoContabilDetalheDeleteParamsSchema.parse(req.params);

        const deleteService = new ConfiguracaoContabilDetalheDeleteService();
        const result = await deleteService.execute({
            configuracaoContabilId,
            detalheId,
        });

        return res.status(200).json(result);
    }
}

