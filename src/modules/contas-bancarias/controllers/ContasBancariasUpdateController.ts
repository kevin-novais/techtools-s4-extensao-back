import { Request, Response } from "express";
import { z } from "zod";
import { ContasBancariasUpdateService } from "@/modules/contas-bancarias/services/ContasBancariasUpdateService";

const paramsSchema = z.object({
    codigoCia: z.string().trim().min(1, "codigoCia é obrigatório").max(10),
    houseBank: z.string().trim().min(1, "houseBank é obrigatório").max(10),
    houseBankAccount: z.string().trim().min(1, "houseBankAccount é obrigatório").max(20),
});

const optNull = (max: number) =>
    z.string().trim().max(max).optional().nullable().transform((v) => (v === "" ? null : v));

const contasBancariasUpdateSchema = z
    .object({
        numeroBanco: optNull(10),
        numeroAgencia: optNull(10),
        nomeBanco: optNull(30),
        digitoAgenca: optNull(3),
        numeroConta: optNull(20),
        digitoConta: optNull(3),
        glAccount: optNull(30),
        numeroBancoLegado: optNull(10),
        numeroAgenciaLegado: optNull(10),
        digitoAgenciaLegado: optNull(3),
        numeroContaLegado: optNull(20),
        digitoContaLegado: optNull(3),
    })
    .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        { message: "Informe ao menos um campo para atualizar" }
    );

export class ContasBancariasUpdateController {
    async handle(req: Request, res: Response) {
        const { codigoCia, houseBank, houseBankAccount } = paramsSchema.parse(req.params);
        const body = contasBancariasUpdateSchema.parse(req.body);

        const updateService = new ContasBancariasUpdateService();
        const conta = await updateService.execute(codigoCia, houseBank, houseBankAccount, body);

        return res.status(200).json({
            message: "Conta bancária atualizada com sucesso",
            conta,
        });
    }
}
