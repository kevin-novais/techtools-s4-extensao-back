import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioListService } from '@/modules/relatorio/services/RelatorioListService';
import { relatorioGrupoSchema } from '@/modules/relatorio/utils/relatorioSchemas';

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
    grupo: relatorioGrupoSchema,
});

export class RelatorioListController {
    async handle(req: Request, res: Response) {
        const { page, pageSize, grupo } = querySchema.parse(req.query);

        const service = new RelatorioListService();
        const result = await service.execute({ page, pageSize, grupo });

        return res.status(200).json(result);
    }
}
