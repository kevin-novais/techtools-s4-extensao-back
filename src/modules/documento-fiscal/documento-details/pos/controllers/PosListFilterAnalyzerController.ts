import { Request, Response } from "express";
import { z } from "zod";
import { PosListFilterAnalyzerService } from "@/modules/documento-fiscal/documento-details/pos/services/PosListFilterAnalyzerService";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const posListFilterAnalyzerSchema = z.object({
    dataEmissaoDe: z
        .string()
        .regex(dateRegex, "Data deve estar no formato YYYY-MM-DD")
        .optional()
        .refine(
            (val) => {
                if (!val) return true;
                const date = new Date(val);
                return !Number.isNaN(date.getTime());
            },
            { message: "Data inválida" }
        ),
    dataEmissaoAte: z
        .string()
        .regex(dateRegex, "Data deve estar no formato YYYY-MM-DD")
        .optional()
        .refine(
            (val) => {
                if (!val) return true;
                const date = new Date(val);
                return !Number.isNaN(date.getTime());
            },
            { message: "Data inválida" }
        ),
    dataVencimentoDe: z
        .string()
        .regex(dateRegex, "Data deve estar no formato YYYY-MM-DD")
        .optional()
        .refine(
            (val) => {
                if (!val) return true;
                const date = new Date(val);
                return !Number.isNaN(date.getTime());
            },
            { message: "Data inválida" }
        ),
    dataVencimentoAte: z
        .string()
        .regex(dateRegex, "Data deve estar no formato YYYY-MM-DD")
        .optional()
        .refine(
            (val) => {
                if (!val) return true;
                const date = new Date(val);
                return !Number.isNaN(date.getTime());
            },
            { message: "Data inválida" }
        ),
    segmento: z.string().optional(),
    page: z
        .string()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : 1))
        .refine((val) => !Number.isNaN(val) && val > 0, {
            message: "Parâmetro 'page' deve ser um número maior que 0",
        }),
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : 20))
        .refine((val) => !Number.isNaN(val) && val > 0, {
            message: "Parâmetro 'limit' deve ser um número maior que 0",
        }),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
});

export class PosListFilterAnalyzerController {
    async handle(req: Request, res: Response) {
        const {
            dataEmissaoDe,
            dataEmissaoAte,
            dataVencimentoDe,
            dataVencimentoAte,
            segmento,
            page,
            limit,
            filterModel,
            sortModel,
        } = posListFilterAnalyzerSchema.parse(req.query);

        const service = new PosListFilterAnalyzerService();
        const result = await service.execute({
            dataEmissaoDe,
            dataEmissaoAte,
            dataVencimentoDe,
            dataVencimentoAte,
            segmento,
            page,
            limit,
            filterModel,
            sortModel,
        });

        return res.status(200).json(result);
    }
}