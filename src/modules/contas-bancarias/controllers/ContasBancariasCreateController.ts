import { Request, Response } from "express";
import { z } from "zod";
import { ContasBancariasCreateService } from "@/modules/contas-bancarias/services/ContasBancariasCreateService";

const opt3 = z.string().trim().max(3).optional().transform((v) => (v === "" ? undefined : v));
const opt10 = z.string().trim().max(10).optional().transform((v) => (v === "" ? undefined : v));
const opt20 = z.string().trim().max(20).optional().transform((v) => (v === "" ? undefined : v));
const opt30 = z.string().trim().max(30).optional().transform((v) => (v === "" ? undefined : v));

const contasBancariasCreateSchema = z.object({
    codigoCia: z.string().trim().min(1, "codigoCia é obrigatório").max(10),
    houseBank: z.string().trim().min(1, "houseBank é obrigatório").max(10),
    houseBankAccount: z.string().trim().min(1, "houseBankAccount é obrigatório").max(20),
    numeroBanco: z.string().trim().min(1, "numeroBanco é obrigatório").max(10),
    numeroAgencia: z.string().trim().min(1, "numeroAgencia é obrigatório").max(10),
    nomeBanco: z.string().trim().min(1, "nomeBanco é obrigatório").max(30),
    digitoAgenca: opt3,
    numeroConta: z.string().trim().min(1, "numeroConta é obrigatório").max(20),
    digitoConta: opt3,
    glAccount: opt30,
    numeroBancoLegado: opt10,
    numeroAgenciaLegado: opt10,
    digitoAgenciaLegado: opt3,
    numeroContaLegado: opt20,
    digitoContaLegado: opt3,
});

export class ContasBancariasCreateController {
    async handle(req: Request, res: Response) {
        const body = contasBancariasCreateSchema.parse(req.body);

        const createService = new ContasBancariasCreateService();
        const conta = await createService.execute(body);

        return res.status(201).json({
            message: "Conta bancária criada com sucesso",
            conta,
        });
    }
}
