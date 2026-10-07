import { Request, Response } from "express";
import { z } from "zod";
import { ContasContabeisCreateService } from "@/modules/contas-contabeis/services/ContasContabeisCreateService";

const optionalStringMax30 = z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalStringMax20 = z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
    .string()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), { message: "Data inválida" })
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const contasContabeisCreateSchema = z.object({
    chartOfAccounts: z.string().trim().min(1, "chartOfAccounts é obrigatório").max(10),
    companyCode: z.string().trim().min(1, "companyCode é obrigatório").max(10),
    glAccount: z.string().trim().min(1, "glAccount é obrigatório").max(30),
    glAccountName: z.string().trim().min(1, "glAccountName é obrigatório").max(100),
    glAccountECD: optionalStringMax30,
    glAccountCosif: optionalStringMax30,
    glContaPaiCosif: optionalStringMax30,
    itemFluxoDeCaixa: z.string().trim().min(1, "itemFluxoDeCaixa é obrigatório").max(20),
    glAccountB1Xtpg: optionalStringMax30,
    xtpgAtivado: z.boolean().optional().default(false),
    centroCusto: optionalStringMax20,
    centroLucro: optionalStringMax20,
    dataInicio: optionalDate,
    dataFim: optionalDate,
});

export class ContasContabeisCreateController {
    async handle(req: Request, res: Response) {
        const body = contasContabeisCreateSchema.parse(req.body);

        const createService = new ContasContabeisCreateService();
        const conta = await createService.execute(body);

        return res.status(201).json({
            message: "Conta contábil criada com sucesso",
            conta,
        });
    }
}
