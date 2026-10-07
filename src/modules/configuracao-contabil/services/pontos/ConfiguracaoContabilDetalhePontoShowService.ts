import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatConfiguracaoContabilDetalhePonto } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";

interface ConfiguracaoContabilDetalhePontoShowServiceParams {
    configuracaoContabilId: number;
    pontoId: number;
}

export class ConfiguracaoContabilDetalhePontoShowService {
    async execute({ configuracaoContabilId, pontoId }: ConfiguracaoContabilDetalhePontoShowServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const ponto = await s4DotzClient.configuracaoContabilDetalhePonto.findUnique({
            where: { id: pontoId },
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
        });

        if (!ponto) {
            throw new AppError("Ponto da configuração contábil não encontrado", 404);
        }

        if (ponto.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Ponto não pertence à configuração informada", 400);
        }

        return formatConfiguracaoContabilDetalhePonto(ponto);
    }
}
