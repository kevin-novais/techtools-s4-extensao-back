import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoErrorsListService } from "@/modules/documento-fiscal/documento-details/documento/services/DocumentoErrorsListService";

const documentoErrorsListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    tipo: z.string().trim().optional(),
    codigoErro: z.string().trim().optional(),
    detalheId: z.coerce.number().int().positive().optional(),
    itemDocumento: z.coerce.number().int().positive().optional(),
});

const documentoErrorsListParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class DocumentoErrorsListController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id: documentoFiscalHeaderId } = documentoErrorsListParamsSchema.parse(req.params);
        const queryParams = documentoErrorsListQuerySchema.parse(req.query);

        const documentoErrorsListService = new DocumentoErrorsListService();
        const result = await documentoErrorsListService.execute({
            ciaIds,
            documentoFiscalHeaderId,
            page: queryParams.page,
            limit: queryParams.limit,
            filterModel: queryParams.filterModel,
            sortModel: queryParams.sortModel,
            tipo: queryParams.tipo,
            detalheId: queryParams.detalheId,
            itemDocumento: queryParams.itemDocumento,
            codigoErro: queryParams.codigoErro,
        });

        return res.status(200).json(result);
    }
}

