import { Request, Response } from "express";
import { z } from "zod";
import { ContasContabeisUpdateService } from "@/modules/contas-contabeis/services/ContasContabeisUpdateService";

const contasContabeisUpdateParamsSchema = z.object({
    chartOfAccounts: z.string().trim().min(1, "chartOfAccounts é obrigatório"),
    companyCode: z.string().trim().min(1, "companyCode é obrigatório"),
    glAccount: z.string().trim().min(1, "glAccount é obrigatório"),
});

const optionalStringMax30 = z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

const optionalStringMax100 = z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

const optionalStringMax10 = z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

const optionalStringMax30Nullable = z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
    .union([z.string(), z.null()])
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val as string)), { message: "Data inválida" })
    .transform((v) => (v === "" ? null : v));

const contasContabeisUpdateSchema = z
    .object({
        glAccountName: optionalStringMax100,
        glAccountECD: optionalStringMax30,
        glAccountCosif: optionalStringMax30,
        glContaPaiCosif: optionalStringMax30,
        itemFluxoDeCaixa: optionalStringMax10,
        glAccountB1Xtpg: optionalStringMax30Nullable,
        xtpgAtivado: z.boolean().optional().nullable(),
        centroCusto: optionalStringMax10,
        centroLucro: optionalStringMax10,
        dataInicio: optionalDate,
        dataFim: optionalDate,
    })
    .refine(
        (data) =>
            Object.values(data).some((value) => value !== undefined && value !== null) ||
            Object.keys(data).some((key) => data[key as keyof typeof data] === null),
        {
            message: "Informe ao menos um campo para atualizar",
        }
    );

export class ContasContabeisUpdateController {
    async handle(req: Request, res: Response) {
        const params = contasContabeisUpdateParamsSchema.parse(req.params);
        const body = contasContabeisUpdateSchema.parse(req.body);

        const updateService = new ContasContabeisUpdateService();
        const conta = await updateService.execute({
            chartOfAccounts: params.chartOfAccounts,
            companyCode: params.companyCode,
            glAccount: params.glAccount,
            data: body,
        });

        return res.status(200).json({
            message: "Conta contábil atualizada com sucesso",
            conta,
        });
    }
}
