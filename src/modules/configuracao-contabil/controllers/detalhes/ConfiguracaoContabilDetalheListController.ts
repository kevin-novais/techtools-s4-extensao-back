import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalheListService } from "@/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheListService";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

const grupoPisCofinsEnum = z.enum([
    GrupoPisConfinsTypes.S,
    GrupoPisConfinsTypes.N,
]);

const configuracaoContabilDetalheListParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalheListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    codigoItem: z.string().trim().optional(),
    grupoPisCofins: grupoPisCofinsEnum.optional(),
});

export class ConfiguracaoContabilDetalheListController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId } = configuracaoContabilDetalheListParamsSchema.parse(req.params);
        const query = configuracaoContabilDetalheListSchema.parse(req.query);

        const listService = new ConfiguracaoContabilDetalheListService();
        const result = await listService.execute({
            configuracaoContabilId,
            ...query,
        });

        return res.status(200).json(result);
    }
}

