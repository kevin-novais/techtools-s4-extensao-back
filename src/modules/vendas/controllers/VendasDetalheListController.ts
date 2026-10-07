import { Request, Response } from "express";
import { z } from "zod";
import { VendasDetalheListService } from "@/modules/vendas/services/VendasDetalheListService";

const vendasDetalheListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    itemDocumento: z.coerce.number().int().positive().optional(),
    codigoProdutoDotz: z.string().trim().optional(),
});

const vendasDetalheListParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasDetalheListController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId } = vendasDetalheListParamsSchema.parse(req.params);
        const queryParams = vendasDetalheListQuerySchema.parse(req.query);

        const vendasDetalheListService = new VendasDetalheListService();
        const result = await vendasDetalheListService.execute({
            ciaIds,
            vendasHeaderId,
            page: queryParams.page,
            limit: queryParams.limit,
            filterModel: queryParams.filterModel,
            sortModel: queryParams.sortModel,
            id: queryParams.id,
            itemDocumento: queryParams.itemDocumento,
            codigoProdutoDotz: queryParams.codigoProdutoDotz,
        });

        return res.status(200).json(result);
    }
}
