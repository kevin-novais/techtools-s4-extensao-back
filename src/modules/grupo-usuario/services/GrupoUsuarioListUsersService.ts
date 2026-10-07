import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { buildPublicFileUrl } from "@/util/file-url";

interface UsuarioGrupoUsuarioRecord {
    atualizadoEm: Date;
    usuario: {
        id: number;
        nome: string;
        email: string;
        avatarUrl: string | null;
        perfil: string;
        ativo: boolean;
    };
}

interface GrupoUsuarioListUsersParams {
    grupoUsuarioId: number;
    page?: number;
    limit?: number;
    search?: string;
}

interface GrupoUsuarioListUsersResponse {
    usuarios: Array<{
        id: number;
        nome: string;
        email: string;
        avatarUrl: string | null;
        perfil: string;
        ativo: boolean;
        vinculadoEm: string;
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

export class GrupoUsuarioListUsersService {
    async execute(params: GrupoUsuarioListUsersParams): Promise<GrupoUsuarioListUsersResponse> {
        const {
            grupoUsuarioId,
            page = 1,
            limit = 10,
            search,
        } = params;

        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
        });

        if (!grupoUsuarioExist) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        const searchTrimmed = search?.trim();

        const where = {
            grupoUsuarioId,
            ...(searchTrimmed
                ? {
                    usuario: {
                        OR: [
                            {
                                nome: {
                                    contains: searchTrimmed,
                                },
                            },
                            {
                                email: {
                                    contains: searchTrimmed,
                                },
                            },
                        ],
                    },
                }
                : {}),
        };

        const skip = (page - 1) * limit;

        const [totalItems, usuariosGrupo] = await Promise.all([
            s4DotzClient.usuarioGrupoUsuario.count({ where }),
            s4DotzClient.usuarioGrupoUsuario.findMany({
                where,
                include: {
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                            avatarUrl: true,
                            perfil: true,
                            ativo: true,
                        },
                    },
                },
                orderBy: {
                    atualizadoEm: 'desc',
                },
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formattedUsuarios = usuariosGrupo.map((ug: UsuarioGrupoUsuarioRecord) => ({
            id: ug.usuario.id,
            nome: ug.usuario.nome,
            email: ug.usuario.email,
            avatarUrl: buildPublicFileUrl(ug.usuario.avatarUrl),
            perfil: ug.usuario.perfil,
            ativo: ug.usuario.ativo,
            vinculadoEm: formatDateToBrazilianTimezone(ug.atualizadoEm),
        }));

        return {
            usuarios: formattedUsuarios,
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

