import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatConfiguracaoContabil } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";

export class ConfiguracaoContabilShowService {
    async execute(id: number) {
        const configuracao = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id },
            include: {
                cia: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                criadoPorUsuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
                atualizadoPorUsuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
                configuracaoContabilDetalhes: {
                    include: {
                        criadoPorUsuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true,
                            },
                        },
                        atualizadoPorUsuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!configuracao) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        return formatConfiguracaoContabil(configuracao);
    }
}


