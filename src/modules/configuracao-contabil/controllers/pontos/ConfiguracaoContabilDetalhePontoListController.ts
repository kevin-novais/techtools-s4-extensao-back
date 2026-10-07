import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilDetalhePontoListService } from "@/modules/configuracao-contabil/services/pontos/ConfiguracaoContabilDetalhePontoListService";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

const grupoPisCofinsEnum = z.enum([
    GrupoPisConfinsTypes.S,
    GrupoPisConfinsTypes.N,
]);

const configuracaoContabilDetalhePontoListParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalhePontoListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    codigoPonto: z.string().trim().optional(),
    grupoPisCofins: grupoPisCofinsEnum.optional(),
    ehPadrao: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
});

export class ConfiguracaoContabilDetalhePontoListController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId } = configuracaoContabilDetalhePontoListParamsSchema.parse(req.params);
        const query = configuracaoContabilDetalhePontoListSchema.parse(req.query);

        const listService = new ConfiguracaoContabilDetalhePontoListService();
        const result = await listService.execute({
            configuracaoContabilId,
            ...query,
        });

        return res.status(200).json(result);
    }
}
