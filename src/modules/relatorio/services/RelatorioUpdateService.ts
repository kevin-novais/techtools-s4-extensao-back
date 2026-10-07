import type { Prisma } from '@prisma/client-s4-dotz';
import s4DotzClient from '@/database/clients/s4DotzClient';
import AppError from '@/util/AppError';
import { validateQuery } from '@/modules/relatorio/utils/validateQuery';
import {
    normalizeVariaveisForPersistence,
    validateVariableDefinitions,
} from '@/modules/relatorio/utils/validateVariableDefinitions';
import { mapStoredVariavelToInput } from '@/modules/relatorio/utils/relatorioVariableTypes';
import { RelatorioVariavelInput } from '@/modules/relatorio/utils/relatorioVariableTypes';
import { mapRelatorioForResponse } from '@/modules/relatorio/utils/relatorioResponseMapper';
import { Perfil } from '@/@types/PermissionsTypes';

interface RelatorioUpdateInput {
    id: number;
    nome?: string;
    descricao?: string | null;
    grupo?: string | null;
    query?: string;
    variaveis?: RelatorioVariavelInput[];
    userId: number;
}

export class RelatorioUpdateService {
    async execute({
        id,
        nome,
        descricao,
        grupo,
        query,
        variaveis,
        userId,
    }: RelatorioUpdateInput) {
        const relatorio = await s4DotzClient.relatorio.findUnique({
            where: { id },
            include: { variaveis: true },
        });

        if (!relatorio) throw new AppError('Relatório não encontrado', 404);

        const queryToValidate = query ?? relatorio.query;
        const variaveisToValidate = variaveis
            ? normalizeVariaveisForPersistence(variaveis)
            : relatorio.variaveis.map(mapStoredVariavelToInput);

        if (query !== undefined) {
            validateQuery(query);
        }

        if (query !== undefined || variaveis !== undefined) {
            validateVariableDefinitions(queryToValidate, variaveisToValidate);
        }

        if (nome && nome !== relatorio.nome) {
            const nomeJaExiste = await s4DotzClient.relatorio.findFirst({
                where: { nome, NOT: { id } },
            });
            if (nomeJaExiste) throw new AppError('Já existe um relatório com esse nome', 409);
        }

        const updated = await s4DotzClient.$transaction(async (tx: Prisma.TransactionClient) => {
            if (variaveis !== undefined) {
                await tx.relatorioVariavel.deleteMany({ where: { relatorioId: id } });
            }

            return tx.relatorio.update({
                where: { id },
                data: {
                    ...(nome !== undefined && { nome }),
                    ...(descricao !== undefined && { descricao }),
                    ...(grupo !== undefined && { grupo }),
                    ...(query !== undefined && { query }),
                    atualizadoPorId: userId,
                    ...(variaveis !== undefined && {
                        variaveis: {
                            create: variaveisToValidate.map((v: RelatorioVariavelInput, index: number) => ({
                                chave: v.chave,
                                label: v.label,
                                tipo: v.tipo,
                                obrigatorio: v.obrigatorio,
                                fusoHorarioBrasil: v.fusoHorarioBrasil ?? false,
                                ordem: v.ordem ?? index,
                            })),
                        },
                    }),
                },
                include: {
                    criadoPor: { select: { id: true, nome: true } },
                    atualizadoPor: { select: { id: true, nome: true } },
                    variaveis: { orderBy: { ordem: 'asc' } },
                },
            });
        });

        return mapRelatorioForResponse(updated, Perfil.ADMIN, { includeQuery: true });
    }
}
