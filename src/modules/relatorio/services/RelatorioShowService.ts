import s4DotzClient from '@/database/clients/s4DotzClient';
import AppError from '@/util/AppError';
import { Perfil } from '@/@types/PermissionsTypes';
import { mapRelatorioForResponse } from '@/modules/relatorio/utils/relatorioResponseMapper';

interface RelatorioShowInput {
    id: number;
    userPerfil?: Perfil | string;
}

export class RelatorioShowService {
    async execute({ id, userPerfil }: RelatorioShowInput) {
        const relatorio = await s4DotzClient.relatorio.findUnique({
            where: { id },
            include: {
                criadoPor: { select: { id: true, nome: true } },
                atualizadoPor: { select: { id: true, nome: true } },
                variaveis: { orderBy: { ordem: 'asc' } },
            },
        });

        if (!relatorio) throw new AppError('Relatório não encontrado', 404);

        return mapRelatorioForResponse(relatorio, userPerfil);
    }
}
