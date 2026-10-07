import { Request, Response } from "express";
import { z } from "zod";
import { RegistrosContabeisUpdateItemFluxoService } from "@/modules/registros-contabeis/services/RegistrosContabeisUpdateItemFluxoService";

const paramsSchema = z.object({
    companyCode: z.string().trim().min(1, "companyCode é obrigatório"),
    fiscalYear: z.string().trim().min(1, "fiscalYear é obrigatório"),
    accountingDocument: z.string().trim().min(1, "accountingDocument é obrigatório"),
    accountingDocumentItem: z.string().trim().min(1, "accountingDocumentItem é obrigatório"),
});

const bodySchema = z.object({
    itemFluxoDeCaixa: z.string().trim().min(1, "itemFluxoDeCaixa é obrigatório").max(20),
});

export class RegistrosContabeisUpdateItemFluxoController {
    async handle(req: Request, res: Response) {
        const params = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);

        const updateService = new RegistrosContabeisUpdateItemFluxoService();
        await updateService.execute({
            companyCode: params.companyCode,
            fiscalYear: params.fiscalYear,
            accountingDocument: params.accountingDocument,
            accountingDocumentItem: params.accountingDocumentItem,
            itemFluxoDeCaixa: body.itemFluxoDeCaixa,
        });

        return res.status(200).json({
            message: "Item de fluxo de caixa atualizado. Registro será reenviado ao XTPG.",
        });
    }
}
