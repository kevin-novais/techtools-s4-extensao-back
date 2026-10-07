import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioShowService } from '@/modules/relatorio/services/RelatorioShowService';

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class RelatorioShowController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);

        const service = new RelatorioShowService();
        const relatorio = await service.execute({
            id,
            userPerfil: req.user?.perfil,
        });

        return res.status(200).json(relatorio);
    }
}
