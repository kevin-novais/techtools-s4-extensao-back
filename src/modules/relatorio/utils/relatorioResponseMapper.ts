import { Perfil } from '@/@types/PermissionsTypes';
import { extractPlaceholderKeys } from '@/modules/relatorio/utils/validateVariableDefinitions';
import {
    mapStoredVariavelToInput,
    RELATORIO_DEFAULT_TIMEZONE,
    RelatorioVariavelInput,
} from '@/modules/relatorio/utils/relatorioVariableTypes';

type RelatorioWithRelations = {
    id: number;
    nome: string;
    descricao: string | null;
    grupo: string | null;
    query: string;
    criadoPorId: number;
    criadoEm: Date;
    atualizadoPorId: number | null;
    atualizadoEm: Date;
    criadoPor?: { id: number; nome: string };
    atualizadoPor?: { id: number; nome: string } | null;
    variaveis?: Array<{
        id: number;
        relatorioId: number;
        chave: string;
        label: string;
        tipo: string;
        obrigatorio: boolean;
        fusoHorarioBrasil: boolean;
        ordem: number;
    }>;
};

type StoredVariavel = NonNullable<RelatorioWithRelations['variaveis']>[number];

export function mapRelatorioVariavel(variavel: StoredVariavel): RelatorioVariavelInput & {
    id: number;
    relatorioId: number;
    fusoHorarioBrasil: boolean;
    timezone?: string;
} {
    const mapped = mapStoredVariavelToInput(variavel);

    return {
        id: variavel.id,
        relatorioId: variavel.relatorioId,
        ...mapped,
        fusoHorarioBrasil: mapped.fusoHorarioBrasil ?? false,
        timezone: mapped.fusoHorarioBrasil ? RELATORIO_DEFAULT_TIMEZONE : undefined,
    };
}

function mapVariaveisUsedInQuery(relatorio: RelatorioWithRelations) {
    const chavesNaQuery = new Set(extractPlaceholderKeys(relatorio.query));

    return (relatorio.variaveis ?? [])
        .map(mapRelatorioVariavel)
        .filter((variavel) => chavesNaQuery.has(variavel.chave));
}

export function mapRelatorioForResponse(
    relatorio: RelatorioWithRelations,
    userPerfil?: Perfil | string,
    options: { includeQuery?: boolean } = {},
) {
    const includeQuery = options.includeQuery ?? userPerfil === Perfil.ADMIN;
    const variaveis = mapVariaveisUsedInQuery(relatorio);

    if (includeQuery) {
        return { ...relatorio, variaveis };
    }

    const { query: _query, ...rest } = relatorio;
    return { ...rest, variaveis };
}

export function mapRelatorioListItem(relatorio: RelatorioWithRelations) {
    const { query: _query, variaveis: _variaveis, ...rest } = relatorio;
    return rest;
}
