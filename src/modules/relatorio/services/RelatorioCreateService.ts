import type { Prisma } from '@prisma/client-s4-dotz';
import s4DotzClient from '@/database/clients/s4DotzClient';
import AppError from '@/util/AppError';
import { validateQuery } from '@/modules/relatorio/utils/validateQuery';
import {
    normalizeVariaveisForPersistence,
    validateVariableDefinitions,
} from '@/modules/relatorio/utils/validateVariableDefinitions';
import { RelatorioVariavelInput } from '@/modules/relatorio/utils/relatorioVariableTypes';
import { mapRelatorioForResponse } from '@/modules/relatorio/utils/relatorioResponseMapper';
import { Perfil } from '@/@types/PermissionsTypes';

interface RelatorioCreateInput {
    nome: string;
    descricao?: string;
    grupo?: string;
    query: string;
    variaveis?: RelatorioVariavelInput[];
    userId: number;
}

export class RelatorioCreateService {
    async execute({ nome, descricao, grupo, query, variaveis = [], userId }: RelatorioCreateInput) {
        validateQuery(query);
        const variaveisNormalizadas = normalizeVariaveisForPersistence(variaveis);
        validateVariableDefinitions(query, variaveisNormalizadas);

        const nomeJaExiste = await s4DotzClient.relatorio.findFirst({
            where: { nome },
        });

        if (nomeJaExiste) {
            throw new AppError('Já existe um relatório com esse nome', 409);
        }

        const relatorio = await s4DotzClient.$transaction(async (tx: Prisma.TransactionClient) => {
            const created = await tx.relatorio.create({
                data: {
                    nome,
                    descricao,
                    grupo,
                    query,
                    criadoPorId: userId,
                    atualizadoPorId: userId,
                    variaveis: {
                        create: variaveisNormalizadas.map((v, index) => ({
                            chave: v.chave,
                            label: v.label,
                            tipo: v.tipo,
                            obrigatorio: v.obrigatorio,
                            fusoHorarioBrasil: v.fusoHorarioBrasil ?? false,
                            ordem: v.ordem ?? index,
                        })),
                    },
                },
                include: {
                    criadoPor: { select: { id: true, nome: true } },
                    variaveis: { orderBy: { ordem: 'asc' } },
                },
            });

            return created;
        });

        return mapRelatorioForResponse(relatorio, Perfil.ADMIN, { includeQuery: true });
    }
}
