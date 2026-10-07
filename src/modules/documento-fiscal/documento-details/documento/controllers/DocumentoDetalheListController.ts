import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoDetalheListService } from "@/modules/documento-fiscal/documento-details/documento/services/DocumentoDetalheListService";

const documentoDetalheListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    itemDocumento: z.coerce.number().int().positive().optional(),
    codigoDocumento: z.string().trim().optional(),
    descricaoProduto: z.string().trim().optional(),
    codigoPedidoParceiro: z.string().trim().optional(),
    codigoPedidoAnalyzer: z.string().trim().optional(),
    divergencias: z
        .string()
        .optional()
        .transform((val) => {
            if (val === undefined) return undefined;
            return val === "true";
        }),
});

const documentoDetalheListParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class DocumentoDetalheListController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id: documentoFiscalHeaderId } = documentoDetalheListParamsSchema.parse(req.params);
        const queryParams = documentoDetalheListQuerySchema.parse(req.query);

        const documentoDetalheListService = new DocumentoDetalheListService();
        const result = await documentoDetalheListService.execute({
            ciaIds,
            documentoFiscalHeaderId,
            page: queryParams.page,
            limit: queryParams.limit,
            filterModel: queryParams.filterModel,
            sortModel: queryParams.sortModel,
            id: queryParams.id,
            itemDocumento: queryParams.itemDocumento,
            codigoDocumento: queryParams.codigoDocumento,
            descricaoProduto: queryParams.descricaoProduto,
            codigoPedidoParceiro: queryParams.codigoPedidoParceiro,
            codigoPedidoAnalyzer: queryParams.codigoPedidoAnalyzer,
            divergencias: queryParams.divergencias,
        });

        return res.status(200).json(result);
    }
}

