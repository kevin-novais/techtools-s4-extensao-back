import { Request, Response } from "express";
import { z } from "zod";
import { ConfiguracaoContabilUpdateService } from "@/modules/configuracao-contabil/services/ConfiguracaoContabilUpdateService";
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

const nullableString = (max: number) =>
    z
        .union([z.string().trim().max(max), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined) {
                return undefined;
            }

            if (value === null) {
                return null;
            }

            return value === "" ? null : value;
        });

const configuracaoContabilUpdateParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const configuracaoContabilUpdateSchema = z.object({
    tipoProcesso: tipoProcessoEnum.optional(),
    tipoDocumentoERP: z.string().trim().min(1, "tipoDocumentoERP não pode ser vazio").max(2, "tipoDocumentoERP deve ter no máximo 2 caracteres").optional(),
    ciaId: z.coerce.number().int().positive().optional(),
    periodoDeDiferimento: z.union([z.coerce.number().int().min(0), z.null()]).optional().transform((value) => (value === undefined ? undefined : value)),
    tipoContabilERP: z.string().trim().min(1, "tipoContabilERP não pode ser vazio").max(20, "tipoContabilERP deve ter no máximo 20 caracteres").optional(),
    textoHeaderContabil: nullableString(25),
    tipoDocumentoXTPG: nullableString(10),
    taxaExpiracao: z.union([z.coerce.number().min(0).max(999.9999), z.null()]).optional(),
}).superRefine((data, ctx) => {
    if (
        data.tipoProcesso &&
        data.tipoProcesso !== TipoProcesso.DR &&
        data.periodoDeDiferimento !== undefined &&
        data.periodoDeDiferimento !== null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)",
            path: ["periodoDeDiferimento"],
        });
    }
    if (
        data.tipoProcesso &&
        data.tipoProcesso !== TipoProcesso.DR &&
        data.tipoDocumentoXTPG !== undefined &&
        data.tipoDocumentoXTPG !== null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tipo do documento XTPG é permitido apenas para o tipo DR (Venda de Pontos)",
            path: ["tipoDocumentoXTPG"],
        });
    }
}).refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Informe ao menos um campo para atualizar" },
);

export class ConfiguracaoContabilUpdateController {
    async handle(req: Request, res: Response) {
        const { id } = configuracaoContabilUpdateParamsSchema.parse(req.params);
        const body = configuracaoContabilUpdateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const updateService = new ConfiguracaoContabilUpdateService();
        const configuracao = await updateService.execute({
            id,
            data: body,
            usuarioId,
        });

        return res.status(200).json({
            message: "Configuração contábil atualizada com sucesso",
            configuracao,
        });
    }
}
