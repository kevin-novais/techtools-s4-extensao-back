import { Request, Response } from "express";
import { z } from "zod";
import {
    CONTROLE_EXPENSE_STATUSES,
    ControleExpenseListService,
} from "@/modules/controle-expense/services/ControleExpenseListService";
import { parseDateForFilter, parseDateForFilterEnd } from "@/util/date";

function isValidDateOnly(value: string): boolean {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

const dateOnlySchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
    .refine(isValidDateOnly, "Data inválida");

const controleExpenseListSchema = z
    .object({
        page: z.coerce.number().int().positive().optional().default(1),
        pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
        status: z.enum(CONTROLE_EXPENSE_STATUSES).optional(),
        reportId: z.coerce.number().int().positive().optional(),
        codigoProtocoloVexpenses: z.string().trim().max(50).optional(),
        codigoDocumentoERP: z.string().trim().max(50).optional(),
        filterModel: z.string().trim().optional(),
        sortModel: z.string().trim().optional(),
        dataAprovacaoInicio: dateOnlySchema.optional().transform((date) =>
            date ? parseDateForFilter(date) : undefined
        ),
        dataAprovacaoFim: dateOnlySchema.optional().transform((date) =>
            date ? parseDateForFilterEnd(date) : undefined
        ),
        dataImportacaoInicio: dateOnlySchema.optional().transform((date) =>
            date ? parseDateForFilter(date) : undefined
        ),
        dataImportacaoFim: dateOnlySchema.optional().transform((date) =>
            date ? parseDateForFilterEnd(date) : undefined
        ),
    })
    .refine(
        (query) =>
            !query.dataAprovacaoInicio ||
            !query.dataAprovacaoFim ||
            query.dataAprovacaoInicio <= query.dataAprovacaoFim,
        {
            path: ["dataAprovacaoFim"],
            message: "Data final de aprovação deve ser maior ou igual à data inicial",
        }
    )
    .refine(
        (query) =>
            !query.dataImportacaoInicio ||
            !query.dataImportacaoFim ||
            query.dataImportacaoInicio <= query.dataImportacaoFim,
        {
            path: ["dataImportacaoFim"],
            message: "Data final de importação deve ser maior ou igual à data inicial",
        }
    );

export class ControleExpenseListController {
    async handle(req: Request, res: Response) {
        const query = controleExpenseListSchema.parse(req.query);

        const listService = new ControleExpenseListService();
        const result = await listService.execute(query);

        return res.status(200).json(result);
    }
}
