import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export class GrupoUsuarioAddUserService {
    async execute(grupoUsuarioId: number, usuarioId: number, atualizadoPor: number) {
        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
        });

        if (!grupoUsuarioExist) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        if (grupoUsuarioExist.deletadoEm) {
            throw new AppError("Grupo de usuário está deletado", 400);
        }

        const usuarioExist = await s4DotzClient.usuario.findUnique({
            where: { id: usuarioId },
        });

        if (!usuarioExist) {
            throw new AppError("Usuário não encontrado", 404);
        }

        if (!usuarioExist.ativo) {
            throw new AppError("Usuário está inativo", 400);
        }

        const usuarioGrupoExist = await s4DotzClient.usuarioGrupoUsuario.findUnique({
            where: {
                usuarioId_grupoUsuarioId: {
                    usuarioId,
                    grupoUsuarioId,
                },
            },
        });

        if (usuarioGrupoExist) {
            throw new AppError("Usuário já está vinculado a este grupo", 400);
        }

        await s4DotzClient.usuarioGrupoUsuario.create({
            data: {
                usuarioId,
                grupoUsuarioId,
                atualizadoPor,
                atualizadoEm: new Date(),
            },
        });

        return {
            message: "Usuário adicionado ao grupo com sucesso",
        };
    }
}

