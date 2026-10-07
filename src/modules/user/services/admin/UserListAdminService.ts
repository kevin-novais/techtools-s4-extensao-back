import s4DotzClient from "@/database/clients/s4DotzClient";
import { Perfil } from "@/@types/PermissionsTypes";
import { buildPublicFileUrl } from "@/util/file-url";

// Campos que podem ser usados na busca universal
const SEARCHABLE_FIELDS: Array<'nome' | 'email'> = ['nome', 'email'];

interface UserListParams {
    page?: number;
    limit?: number;
    search?: string;
    perfil?: Perfil;
    ativo?: boolean;
}

interface UserListResponse {
    users: Array<{
        id: number;
        email: string;
        nome: string;
        ativo: boolean;
        perfil: string;
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

type UserListItem = {
    id: number;
    email: string;
    nome: string;
    ativo: boolean;
    perfil: Perfil;
    avatarUrl: string | null;
};

export class UserListService {

    async execute(params: UserListParams = {}): Promise<UserListResponse> {
        const {
            page = 1,
            limit = 10,
            search,
            perfil,
            ativo,
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
                        ...SEARCHABLE_FIELDS.map(field => ({
                            [field]: {
                                contains: searchTrimmed,
                            },
                        })),
                    ],
                }
                : {}),
            ...(perfil ? { perfil } : {}),
            ...(ativo !== undefined ? { ativo } : {}),
        };

        const skip = (page - 1) * limit;

        // Buscar total de registros e usuários paginados em paralelo
        const [totalItems, users] = await Promise.all([
            s4DotzClient.usuario.count({ where }),
            s4DotzClient.usuario.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    nome: true,
                    ativo: true,
                    perfil: true,
                    avatarUrl: true,
                },
                orderBy: {
                    id: 'asc',
                },
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);
        const formattedUsers = users.map((user: UserListItem) => ({
            ...user,
            avatarUrl: buildPublicFileUrl(user.avatarUrl),
        }));

        return {
            users: formattedUsers,
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