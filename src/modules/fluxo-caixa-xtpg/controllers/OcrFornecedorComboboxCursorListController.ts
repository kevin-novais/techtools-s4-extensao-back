import { Request, Response } from "express";
import { z } from "zod";
import { OcrFornecedorComboboxCursorListService } from "@/modules/fluxo-caixa-xtpg/services/OcrFornecedorComboboxCursorListService";

const querySchema = z.object({
    cursor: z.string().trim().optional(),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().trim().max(120).optional(),
});

export class OcrFornecedorComboboxCursorListController {
    async handle(req: Request, res: Response) {
        const query = querySchema.parse(req.query);
        const service = new OcrFornecedorComboboxCursorListService();
        const result = await service.execute(query);
        return res.status(200).json(result);
    }
}
