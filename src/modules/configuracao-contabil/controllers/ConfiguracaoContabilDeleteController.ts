import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDeleteService } from "@/modules/configuracao-contabil/services/ConfiguracaoContabilDeleteService";

const configuracaoContabilDeleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class ConfiguracaoContabilDeleteController {
    async handle(req: Request, res: Response) {
        const { id } = configuracaoContabilDeleteParamsSchema.parse(req.params);

        const deleteService = new ConfiguracaoContabilDeleteService();
        const result = await deleteService.execute(id);

        return res.status(200).json(result);
    }
}


