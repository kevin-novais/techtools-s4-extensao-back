import { Request, Response } from 'express';
import { z } from 'zod';
import { RelatorioCreateService } from '@/modules/relatorio/services/RelatorioCreateService';
import { relatorioGrupoSchema, relatorioVariavelSchema } from '@/modules/relatorio/utils/relatorioSchemas';

const relatorioCreateSchema = z.object({
    nome: z.string().trim().min(1, 'nome é obrigatório').max(200),
    descricao: z.string().trim().max(500).optional().transform(v => v === '' ? undefined : v),
    grupo: relatorioGrupoSchema,
    query: z.string().trim().min(1, 'query é obrigatória'),
    variaveis: z.array(relatorioVariavelSchema).default([]),
});

export class RelatorioCreateController {
    async handle(req: Request, res: Response) {
        const body = relatorioCreateSchema.parse(req.body);
        const userId = req.user?.id!;

        const service = new RelatorioCreateService();
        const relatorio = await service.execute({ ...body, userId });

        return res.status(201).json({ message: 'Relatório criado com sucesso', relatorio });
    }
}
