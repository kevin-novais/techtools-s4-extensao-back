import { Request, Response } from "express";
import { z } from "zod";
import { FluxoCaixaCiaTipoLancamentoDeleteService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoDeleteService";

const isReversedField = z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
        if (v === true || v === "X" || v === "true" || v === "1") return "X";
        return "";
    });

const querySchema = z.object({
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
        .transform((s) => s.toUpperCase()),
});

export class FluxoCaixaCiaTipoLancamentoDeleteController {
    async handle(req: Request, res: Response) {
        const q = querySchema.parse(req.query);
        const service = new FluxoCaixaCiaTipoLancamentoDeleteService();
        const result = await service.execute({
            companyCode: q.companyCode,
            postingKey: q.postingKey,
            documentType: q.documentType,
            referenceDocumentType: q.referenceDocumentType,
            isReversed: q.isReversed ?? "",
            reversalReason: q.reversalReason,
            debitCreditCode: q.debitCreditCode,
        });
        return res.status(200).json(result);
    }
}
