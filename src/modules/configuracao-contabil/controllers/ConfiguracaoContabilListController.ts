import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilListService } from "@/modules/configuracao-contabil/services/ConfiguracaoContabilListService";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

const tipoProcessoEnum = z.enum([
    TipoProcesso.TP_ROM,
    TipoProcesso.TP_POS,
    TipoProcesso.DR,
    TipoProcesso.PD,
    TipoProcesso.RD,
    TipoProcesso.XTPG_R,
    TipoProcesso.VEX,
]);

const configuracaoContabilListSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    ciaId: z.coerce.number().int().positive().optional(),
    tipoProcesso: tipoProcessoEnum.optional(),
    periodoDeDiferimento: z.coerce.number().int().positive().min(1).optional(),
    tipoContabilERP: z.string().trim().max(20).optional(),
    textoHeaderContabil: z.string().trim().max(25).optional(),
    taxaExpiracao: z.coerce.number().min(0).max(999.9999).optional(),
});

export class ConfiguracaoContabilListController {
    async handle(req: Request, res: Response) {
        const query = configuracaoContabilListSchema.parse(req.query);

        const listService = new ConfiguracaoContabilListService();
        const configuracoes = await listService.execute(query);

        return res.status(200).json(configuracoes);
    }
}
