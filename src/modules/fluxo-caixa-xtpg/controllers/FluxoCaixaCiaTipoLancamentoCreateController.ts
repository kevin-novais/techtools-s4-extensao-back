import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaTipoLancamentoCreateService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoCreateService";

const isReversedField = z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
        if (v === true || v === "X" || v === "true" || v === "1") return "X";
        return "";
    });

const bodySchema = z.object({
    companyCode: z.string().optional().default(""),
    postingKey: z.string().trim().min(1),
    documentType: z.string().trim().min(1),
    referenceDocumentType: z.string().optional().default(""),
    isReversed: isReversedField,
    reversalReason: z.string().optional().default(""),
    debitCreditCode: z
        .string()
        .trim()
        .min(1)
        .transform((s) => s.toUpperCase())
        .refine((s) => s === "S" || s === "H", { message: "debitCreditCode deve ser S ou H" }),
    itemFluxoCaixa: z.string().trim().min(1).max(20),
});

export class FluxoCaixaCiaTipoLancamentoCreateController {
    async handle(req: Request, res: Response) {
        const body = bodySchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const service = new FluxoCaixaCiaTipoLancamentoCreateService();
        const result = await service.execute({
            companyCode: body.companyCode,
            postingKey: body.postingKey,
            documentType: body.documentType,
            referenceDocumentType: body.referenceDocumentType,
            isReversed: body.isReversed ?? "",
            reversalReason: body.reversalReason,
            debitCreditCode: body.debitCreditCode,
            itemFluxoCaixa: body.itemFluxoCaixa,
            usuarioId,
        });

        return res.status(201).json({
            message: "Parâmetro criado com sucesso",
            parametro: result,
        });
    }
}
