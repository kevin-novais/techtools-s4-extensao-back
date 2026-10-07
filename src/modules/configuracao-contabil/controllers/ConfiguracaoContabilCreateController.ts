import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilCreateService } from "@/modules/configuracao-contabil/services/ConfiguracaoContabilCreateService";
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

const optionalString = (max: number) =>
    z.string()
        .trim()
        .max(max)
        .optional()
        .transform((value) => (value === "" ? undefined : value));

const configuracaoContabilCreateSchema = z.object({
    tipoProcesso: tipoProcessoEnum,
    tipoDocumentoERP: z.string().trim().min(1, "tipoDocumentoERP é obrigatório").max(2, "tipoDocumentoERP deve ter no máximo 2 caracteres"),
    ciaId: z.coerce.number().int().positive(),
    periodoDeDiferimento: z.coerce.number().int().min(0).optional(),
    tipoContabilERP: z.string().trim().min(1, "tipoContabilERP é obrigatório").max(20, "tipoContabilERP deve ter no máximo 20 caracteres"),
    textoHeaderContabil: optionalString(25),
    tipoDocumentoXTPG: optionalString(10),
    taxaExpiracao: z.coerce.number().min(0).max(999.9999).optional(),
}).superRefine((data, ctx) => {
    if (data.tipoProcesso !== TipoProcesso.DR && data.periodoDeDiferimento !== undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)",
            path: ["periodoDeDiferimento"],
        });
    }
    if (data.tipoProcesso !== TipoProcesso.DR && data.tipoDocumentoXTPG !== undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tipo do documento XTPG é permitido apenas para o tipo DR (Venda de Pontos)",
            path: ["tipoDocumentoXTPG"],
        });
    }
});

export class ConfiguracaoContabilCreateController {
    async handle(req: Request, res: Response) {
        const body = configuracaoContabilCreateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const createService = new ConfiguracaoContabilCreateService();
        const configuracao = await createService.execute({
            data: body,
            usuarioId,
        });

        return res.status(201).json({
            message: "Configuração contábil criada com sucesso",
            configuracao,
        });
    }
}
