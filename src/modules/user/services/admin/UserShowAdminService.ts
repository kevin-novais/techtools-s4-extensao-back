import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { buildPublicFileUrl } from "@/util/file-url";

export class UserShowAdminService {
    async execute(userId: number) {
        const user = await s4DotzClient.usuario.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                nome: true,
                ativo: true,
                perfil: true,
                avatarUrl: true,
                atualizadoPor: true,
                atualizadoEm: true,
            }
        });

        if (!user) {
            throw new AppError("Usuário não encontrado", 404);
        }
        

        const userAtualizadoPor = await s4DotzClient.usuario.findUnique({
            where: { id: user.atualizadoPor },
            select: {
                id: true,
                nome: true,
                email: true,
            }
        });

        return {
            id: user.id,
            email: user.email,
            nome: user.nome,
            ativo: user.ativo,
            perfil: user.perfil,
            avatarUrl: buildPublicFileUrl(user.avatarUrl),
            atualizadoPor: userAtualizadoPor
                ? {
                    id: userAtualizadoPor.id,
                    nome: userAtualizadoPor.nome,
                    email: userAtualizadoPor.email,
                }
                : {
                    nome: "Não informado",
                    email: "Não informado",
                },
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm),
        };
    }
}

