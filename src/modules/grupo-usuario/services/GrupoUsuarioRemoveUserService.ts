import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export class GrupoUsuarioRemoveUserService {
    async execute(grupoUsuarioId: number, usuarioId: number) {
        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
        });

        if (!grupoUsuarioExist) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        if (grupoUsuarioExist.deletadoEm) {
            throw new AppError("Grupo de usuário está deletado", 400);
        }

        const usuarioGrupoExist = await s4DotzClient.usuarioGrupoUsuario.findUnique({
            where: {
                usuarioId_grupoUsuarioId: {
                    usuarioId,
                    grupoUsuarioId,
                },
            },
        });

        if (!usuarioGrupoExist) {
            throw new AppError("Usuário não encontrado neste grupo", 404);
        }

        await s4DotzClient.usuarioGrupoUsuario.delete({
            where: {
                usuarioId_grupoUsuarioId: {
                    usuarioId,
                    grupoUsuarioId,
                },
            },
        });

        return {
            message: "Usuário removido do grupo com sucesso",
        };
    }
}

