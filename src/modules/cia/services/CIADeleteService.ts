import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface GrupoUsuarioRecord {
    id: number;
}

export class CIADeleteService {
    async execute(ciaId: number, atualizadoPor: number) {
        const ciaExist = await s4DotzClient.cia.findUnique({
            where: { id: ciaId },
            include: {
                gruposUsuario: {
                    where: {
                        deletadoEm: null,
                    },
                },
            },
        });

        if (!ciaExist) {
            throw new AppError("CIA não encontrada", 404);
        }

        if (ciaExist.deletadoEm) {
            throw new AppError("CIA já está deletada", 400);
        }

        const now = new Date();

        await s4DotzClient.$transaction([
            s4DotzClient.cia.update({
                where: { id: ciaId },
                data: {
                    deletadoEm: now,
                    atualizadoPor,
                    atualizadoEm: now,
                },
            }),
            ...ciaExist.gruposUsuario.map((grupo: GrupoUsuarioRecord) =>
                s4DotzClient.grupoUsuario.update({
                    where: { id: grupo.id },
                    data: {
                        deletadoEm: now,
                        atualizadoPor,
                        atualizadoEm: now,
                    },
                })
            ),
        ]);

        return {
            message: "CIA deletada com sucesso",
        };
    }
}

