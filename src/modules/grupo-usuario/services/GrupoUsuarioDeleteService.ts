import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface UsuarioGrupoRecord {
    usuarioId: number;
}

export class GrupoUsuarioDeleteService {
    async execute(grupoUsuarioId: number, atualizadoPor: number) {
        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
            include: {
                usuarios: true,
            },
        });

        if (!grupoUsuarioExist) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        if (grupoUsuarioExist.deletadoEm) {
            throw new AppError("Grupo de usuário já está deletado", 400);
        }

        const now = new Date();

        await s4DotzClient.$transaction([
            s4DotzClient.grupoUsuario.update({
                where: { id: grupoUsuarioId },
                data: {
                    deletadoEm: now,
                    atualizadoPor,
                    atualizadoEm: now,
                },
            }),
            ...grupoUsuarioExist.usuarios.map((usuarioGrupo: UsuarioGrupoRecord) =>
                s4DotzClient.usuarioGrupoUsuario.delete({
                    where: {
                        usuarioId_grupoUsuarioId: {
                            usuarioId: usuarioGrupo.usuarioId,
                            grupoUsuarioId: grupoUsuarioId,
                        },
                    },
                })
            ),
        ]);

        return {
            message: "Grupo de usuário deletado com sucesso",
        };
    }
}

