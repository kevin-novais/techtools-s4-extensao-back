import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone, formatDateOnly } from "@/util/date";

interface GrupoUsuarioCreateServiceProps {
    ciaId: number;
    nome: string;
    dataInicio: Date;
    dataFim: Date;
    aprovaDivergencia: boolean;
    atualizadoPor: number;
}

export class GrupoUsuarioCreateService {
    async execute({
        ciaId,
        nome,
        dataInicio,
        dataFim,
        aprovaDivergencia,
        atualizadoPor,
    }: GrupoUsuarioCreateServiceProps) {
        const ciaExist = await s4DotzClient.cia.findUnique({
            where: { id: ciaId },
        });

        if (!ciaExist) {
            throw new AppError("CIA não encontrada", 404);
        }

        if (ciaExist.deletadoEm) {
            throw new AppError("CIA está deletada", 400);
        }

        const grupoUsuarioExist = await s4DotzClient.grupoUsuario.findFirst({
            where: { nome },
        });

        if (grupoUsuarioExist) {
            throw new AppError("Nome de grupo de usuário já cadastrado", 400);
        }

        const grupoUsuario = await s4DotzClient.grupoUsuario.create({
            data: {
                ciaId,
                nome,
                dataInicio,
                dataFim,
                aprovaDivergencia,
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

        if (!grupoUsuario) {
            throw new AppError("Erro ao criar grupo de usuário", 400);
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
            cia: grupoUsuario.cia,
        };

        return formattedGrupoUsuario;
    }
}

