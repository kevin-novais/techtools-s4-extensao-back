import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateToBrazilianTimezone, formatDateOnly } from "@/util/date";

interface GrupoUsuarioRecord {
    id: number;
    ciaId: number;
    nome: string;
    dataInicio: Date;
    dataFim: Date;
    aprovaDivergencia: boolean;
    atualizadoPor: number;
    atualizadoEm: Date;
    deletadoEm: Date | null;
    cia: {
        id: number;
        nome: string;
    };
    _count: {
        usuarios: number;
    };
}

interface GrupoUsuarioListParams {
    page?: number;
    limit?: number;
    search?: string;
    grupoId?: number;
    aprovaDivergencia?: boolean;
    includeDeleted?: boolean;
}

interface GrupoUsuarioListResponse {
    gruposUsuario: Array<{
        id: number;
        ciaId: number;
        nome: string;
        dataInicio: string;
        dataFim: string;
        aprovaDivergencia: boolean;
        atualizadoPor: number;
        atualizadoEm: string;
        deletadoEm: string | null;
        quantidadeUsuarios: number;
        cia: {
            id: number;
            nome: string;
        };
    }>;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class GrupoUsuarioListService {
    async execute(params: GrupoUsuarioListParams = {}): Promise<GrupoUsuarioListResponse> {
        const {
            page = 1,
            limit = 10,
            search,
            grupoId,
            aprovaDivergencia,
            includeDeleted = false,
        } = params;

        const searchTrimmed = search?.trim();
        const isNumericSearch = searchTrimmed && !isNaN(Number(searchTrimmed));

        const where = {
            ...(searchTrimmed
                ? {
                    OR: [
                        ...(isNumericSearch
                            ? [{ id: Number(searchTrimmed) }]
                            : []),
                        {
                            nome: {
                                contains: searchTrimmed,
                            },
                        },
                        {
                            cia: {
                                nome: {
                                    contains: searchTrimmed,
                                },
                            },
                        },
                    ],
                }
                : {}),
            ...(grupoId ? { id: grupoId } : {}),
            ...(aprovaDivergencia !== undefined ? { aprovaDivergencia } : {}),
            ...(includeDeleted ? {} : { deletadoEm: null }),
        };

        const skip = (page - 1) * limit;

        const [totalItems, gruposUsuario] = await Promise.all([
            s4DotzClient.grupoUsuario.count({ where }),
            s4DotzClient.grupoUsuario.findMany({
                where,
                include: {
                    cia: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },
                    _count: {
                        select: {
                            usuarios: true,
                        },
                    },
                },
                orderBy: {
                    id: 'asc',
                },
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formattedGruposUsuario = gruposUsuario.map((grupo: GrupoUsuarioRecord) => ({
            id: grupo.id,
            ciaId: grupo.ciaId,
            nome: grupo.nome,
            dataInicio: formatDateOnly(grupo.dataInicio),
            dataFim: formatDateOnly(grupo.dataFim),
            aprovaDivergencia: grupo.aprovaDivergencia,
            atualizadoPor: grupo.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(grupo.atualizadoEm),
            deletadoEm: grupo.deletadoEm ? formatDateToBrazilianTimezone(grupo.deletadoEm) : null,
            quantidadeUsuarios: grupo._count.usuarios,
            cia: grupo.cia,
        }));

        return {
            gruposUsuario: formattedGruposUsuario,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}

