import { Request, Response } from "express";
import { z } from "zod";
import { ContasBancariasDeleteService } from "@/modules/contas-bancarias/services/ContasBancariasDeleteService";

const paramsSchema = z.object({
    codigoCia: z.string().trim().min(1, "codigoCia é obrigatório").max(10),
    houseBank: z.string().trim().min(1, "houseBank é obrigatório").max(10),
    houseBankAccount: z.string().trim().min(1, "houseBankAccount é obrigatório").max(20),
});

export class ContasBancariasDeleteController {
    async handle(req: Request, res: Response) {
        const { codigoCia, houseBank, houseBankAccount } = paramsSchema.parse(req.params);

        const deleteService = new ContasBancariasDeleteService();
        const result = await deleteService.execute(codigoCia, houseBank, houseBankAccount);

        return res.status(200).json(result);
    }
}
