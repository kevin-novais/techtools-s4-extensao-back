import s4DotzClient from '@/database/clients/s4DotzClient';
import { buildRelatorioGrupoWhere } from '@/modules/relatorio/utils/buildRelatorioGrupoWhere';
import { mapRelatorioListItem } from '@/modules/relatorio/utils/relatorioResponseMapper';

interface RelatorioListInput {
    page?: number;
    pageSize?: number;
    grupo?: string;
}

export class RelatorioListService {
    async execute({ page = 1, pageSize = 50, grupo }: RelatorioListInput) {
        const skip = (Math.max(page, 1) - 1) * pageSize;
        const where = await buildRelatorioGrupoWhere(grupo);

        const [data, total] = await Promise.all([
            s4DotzClient.relatorio.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { criadoEm: 'desc' },
                include: {
                    criadoPor: { select: { id: true, nome: true } },
                    atualizadoPor: { select: { id: true, nome: true } },
                },
            }),
            s4DotzClient.relatorio.count({ where }),
        ]);

        return {
            data: data.map(mapRelatorioListItem),
            total,
            page,
            pageSize,
        };
    }
}
