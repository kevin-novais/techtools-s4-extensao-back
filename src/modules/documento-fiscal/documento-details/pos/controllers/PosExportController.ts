import { Request, Response } from "express";
import { z } from "zod";
import { PosExportService } from "@/modules/documento-fiscal/documento-details/pos/services/PosExportService";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const posExportSchema = z.object({
    dataEmissaoDe: z.string().regex(dateRegex, "Data deve estar no formato YYYY-MM-DD").optional(),
    dataEmissaoAte: z.string().regex(dateRegex, "Data deve estar no formato YYYY-MM-DD").optional(),
    dataVencimentoDe: z.string().regex(dateRegex, "Data deve estar no formato YYYY-MM-DD").optional(),
    dataVencimentoAte: z.string().regex(dateRegex, "Data deve estar no formato YYYY-MM-DD").optional(),
    segmento: z.string().optional(),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
});

export class PosExportController {
    async handle(req: Request, res: Response) {
        const {
            dataEmissaoDe,
            dataEmissaoAte,
            dataVencimentoDe,
            dataVencimentoAte,
            segmento,
            filterModel,
            sortModel,
        } = posExportSchema.parse(req.query);

        const exportService = new PosExportService();
        const buffer = await exportService.execute({
            dataEmissaoDe,
            dataEmissaoAte,
            dataVencimentoDe,
            dataVencimentoAte,
            segmento,
            filterModel,
            sortModel,
        });

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="pedidos-pos-export.xlsx"'
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.send(buffer);
    }
}
