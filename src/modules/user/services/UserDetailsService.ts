import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { buildPublicFileUrl } from "@/util/file-url";

export class UserDetailsService {
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
                atualizadoEm: true,
            }
        });

        if (!user) {
            throw new AppError("Usuário não encontrado", 404);
        }

        const formattedUser = {
            id: user.id,
            nome: user.nome,
            email: user.email,
            ativo: user.ativo,
            perfil: user.perfil,
            avatarUrl: buildPublicFileUrl(user.avatarUrl),
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm),
        };

        return formattedUser;
    }
}