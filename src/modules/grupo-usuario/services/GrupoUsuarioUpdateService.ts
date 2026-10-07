import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone, formatDateOnly } from "@/util/date";

interface GrupoUsuarioUpdateServiceProps {
    nome?: string;
    dataInicio?: Date;
    dataFim?: Date;
    aprovaDivergencia?: boolean;
    atualizadoPor: number;
}

export class GrupoUsuarioUpdateService {
    async execute(grupoUsuarioId: number, data: GrupoUsuarioUpdateServiceProps) {
        const { nome, dataInicio, dataFim, aprovaDivergencia, atualizadoPor } = data;

        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findUnique({
            where: { id: grupoUsuarioId },
        });

        if (!grupoUsuarioExist) {
            throw new AppError("Grupo de usuário não encontrado", 404);
        }

        if (grupoUsuarioExist.deletadoEm) {
            throw new AppError("Grupo de usuário não pode ser atualizado pois está deletado", 400);
        }

        if (nome && nome !== grupoUsuarioExist.nome) {
            const grupoUsuarioExistNome = await s4DotzClient.grupoUsuario.findFirst({
                where: { nome },
            });

            if (grupoUsuarioExistNome) {
                throw new AppError("Nome de grupo de usuário já utilizado", 400);
            }
        }

        const grupoUsuario = await s4DotzClient.grupoUsuario.update({
            where: { id: grupoUsuarioId },
            data: {
                ...(nome !== undefined && { nome }),
                ...(dataInicio !== undefined && { dataInicio }),
                ...(dataFim !== undefined && { dataFim }),
                ...(aprovaDivergencia !== undefined && { aprovaDivergencia }),
                atualizadoPor,
                atualizadoEm: new Date(),
            },
            include: {
                cia: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });

        return {
            id: grupoUsuario.id,
            ciaId: grupoUsuario.ciaId,
            nome: grupoUsuario.nome,
            dataInicio: formatDateOnly(grupoUsuario.dataInicio),
            dataFim: formatDateOnly(grupoUsuario.dataFim),
            aprovaDivergencia: grupoUsuario.aprovaDivergencia,
            atualizadoPor: grupoUsuario.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(grupoUsuario.atualizadoEm),
            cia: grupoUsuario.cia,
        };
    }
}

