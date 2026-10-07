import { Request, Response } from "express";
import { z } from "zod";
import { ContasBancariasShowService } from "@/modules/contas-bancarias/services/ContasBancariasShowService";

const paramsSchema = z.object({
    codigoCia: z.string().trim().min(1, "codigoCia é obrigatório").max(10),
    houseBank: z.string().trim().min(1, "houseBank é obrigatório").max(10),
    houseBankAccount: z.string().trim().min(1, "houseBankAccount é obrigatório").max(20),
});

export class ContasBancariasShowController {
    async handle(req: Request, res: Response) {
        const { codigoCia, houseBank, houseBankAccount } = paramsSchema.parse(req.params);

        const showService = new ContasBancariasShowService();
        const conta = await showService.execute(codigoCia, houseBank, houseBankAccount);

        return res.status(200).json(conta);
    }
}
