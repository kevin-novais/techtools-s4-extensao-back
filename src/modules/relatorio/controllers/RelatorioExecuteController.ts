import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioExecuteService } from '@/modules/relatorio/services/RelatorioExecuteService';
import { reportVariablesSchema } from '@/modules/relatorio/utils/relatorioSchemas';

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const filterSchema = z.object({
    column: z.string().min(1),
    operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE']),
    value: z.union([z.string(), z.number()]),
});

const orderBySchema = z.object({
    column: z.string().min(1),
    direction: z.enum(['ASC', 'DESC']),
});

const bodySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
    filters: z.array(filterSchema).optional().default([]),
    orderBy: orderBySchema.optional(),
    variables: reportVariablesSchema,
});

export class RelatorioExecuteController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);
        const { page, pageSize, filters, orderBy, variables } = bodySchema.parse(req.body);
        const userId = req.user?.id!;

        const service = new RelatorioExecuteService();
        const result = await service.execute({
            id,
            userId,
            page,
            pageSize,
            filters,
            orderBy,
            variables,
        });

        return res.status(200).json(result);
    }
}
