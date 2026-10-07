import s4DotzClient from '@/database/clients/s4DotzClient';
import AppError from '@/util/AppError';

interface RelatorioDeleteInput {
    id: number;
}

export class RelatorioDeleteService {
    async execute({ id }: RelatorioDeleteInput) {
        const relatorio = await s4DotzClient.relatorio.findUnique({ where: { id } });

        if (!relatorio) throw new AppError('Relatório não encontrado', 404);

        await s4DotzClient.relatorio.delete({ where: { id } });
    }
}
