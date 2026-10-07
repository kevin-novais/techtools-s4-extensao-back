import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioUpdateService } from '@/modules/relatorio/services/RelatorioUpdateService';
import {
    relatorioDescricaoUpdateSchema,
    relatorioGrupoUpdateSchema,
    relatorioVariavelSchema,
} from '@/modules/relatorio/utils/relatorioSchemas';

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
    nome: z.string().trim().min(1).max(200).optional(),
    descricao: relatorioDescricaoUpdateSchema,
    grupo: relatorioGrupoUpdateSchema,
    query: z.string().trim().min(1).optional(),
    variaveis: z.array(relatorioVariavelSchema).optional(),
});

export class RelatorioUpdateController {
    async handle(req: Request, res: Response) {
        const { id } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        const userId = req.user?.id!;

        const service = new RelatorioUpdateService();
        const relatorio = await service.execute({ id, ...body, userId });

        return res.status(200).json({ message: 'Relatório atualizado com sucesso', relatorio });
    }
}
