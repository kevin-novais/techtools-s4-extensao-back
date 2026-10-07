import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone, formatDateOnly } from "@/util/date";

export class GrupoUsuarioShowService {
    async execute(grupoUsuarioId: number) {
        const grupoUsuario = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
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
        });

        if (!grupoUsuario) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        const formattedGrupoUsuario = {
            id: grupoUsuario.id,
            ciaId: grupoUsuario.ciaId,
            nome: grupoUsuario.nome,
            dataInicio: formatDateOnly(grupoUsuario.dataInicio),
            dataFim: formatDateOnly(grupoUsuario.dataFim),
            aprovaDivergencia: grupoUsuario.aprovaDivergencia,
            atualizadoPor: grupoUsuario.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(grupoUsuario.atualizadoEm),
            deletadoEm: grupoUsuario.deletadoEm ? formatDateToBrazilianTimezone(grupoUsuario.deletadoEm) : null,
            quantidadeUsuarios: grupoUsuario._count.usuarios,
            cia: grupoUsuario.cia,
        };

        return formattedGrupoUsuario;
    }
}

