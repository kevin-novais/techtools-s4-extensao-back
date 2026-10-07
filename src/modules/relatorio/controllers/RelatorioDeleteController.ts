import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioDeleteService } from '@/modules/relatorio/services/RelatorioDeleteService';

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class RelatorioDeleteController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);

        const service = new RelatorioDeleteService();
        await service.execute({ id });

        return res.status(204).send();
    }
}
