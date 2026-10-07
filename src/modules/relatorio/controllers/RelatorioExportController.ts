import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioExportService } from '@/modules/relatorio/services/RelatorioExportService';
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
    filters: z.array(filterSchema).optional().default([]),
    orderBy: orderBySchema.optional(),
    variables: reportVariablesSchema,
});

export class RelatorioExportController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);
        const { filters, orderBy, variables } = bodySchema.parse(req.body ?? {});
        const userId = req.user?.id!;

        const service = new RelatorioExportService();
        // O service escreve a resposta diretamente em streaming (headers +
        // corpo do XLSX), já que o arquivo pode ser grande demais para caber
        // em um buffer único na memória.
        await service.execute({
            id,
            userId,
            filters,
            orderBy,
            variables,
            res,
        });
    }
}
