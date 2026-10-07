import { Request, Response } from "express";
import { z } from "zod";
import { parseDateAsBrazilian } from "@/util/date";
import { PosCreateService } from "@/modules/documento-fiscal/documento-header/pos/services/PosCreateService";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const posCreateSchema = z.object({
    ciaId: z.number().int().positive(),
    dataEmissao: z
        .string()
        .regex(dateRegex, "Data de emissão deve estar no formato YYYY-MM-DD")
        .refine((val) => !Number.isNaN(Date.parse(val)), {
            message: "Data de emissão inválida",
        }),
    dataLancamentoContabil: z
        .string()
        .regex(dateRegex, "Data de lançamento contábil deve estar no formato YYYY-MM-DD")
        .refine((val) => !Number.isNaN(Date.parse(val)), {
            message: "Data de lançamento contábil inválida",
        }),
    dataVencimento: z
        .string()
        .regex(dateRegex, "Data de vencimento deve estar no formato YYYY-MM-DD")
        .refine((val) => !Number.isNaN(Date.parse(val)), {
            message: "Data de vencimento inválida",
        }),

    // Filtros que foram aplicados na listagem
    filtros: z.object({
        dataEmissaoDe: z.string().regex(dateRegex, "Data inicial deve estar no formato YYYY-MM-DD").optional(),
        dataEmissaoAte: z.string().regex(dateRegex, "Data final deve estar no formato YYYY-MM-DD").optional(),
        dataVencimentoDe: z.string().regex(dateRegex, "Data de vencimento inicial deve estar no formato YYYY-MM-DD").optional(),
        dataVencimentoAte: z.string().regex(dateRegex, "Data de vencimento final deve estar no formato YYYY-MM-DD").optional(),
        segmento: z.string().optional(),
    }),
});

export class PosCreateController {
    async handle(req: Request, res: Response) {
        const data = posCreateSchema.parse(req.body);
        const usuarioId = req.user!.id;

        const service = new PosCreateService();
        const result = await service.execute({
            ciaId: data.ciaId,
            dataEmissao: parseDateAsBrazilian(data.dataEmissao),
            dataLancamentoContabil: parseDateAsBrazilian(data.dataLancamentoContabil),
            dataVencimento: parseDateAsBrazilian(data.dataVencimento),
            filtros: data.filtros,
            usuarioId,
        });

        return res.status(201).json(result);
    }
}
