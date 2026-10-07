import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatConfiguracaoContabilDetalhe } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";

interface ConfiguracaoContabilDetalheShowServiceParams {
    configuracaoContabilId: number;
    detalheId: number;
}

export class ConfiguracaoContabilDetalheShowService {
    async execute({ configuracaoContabilId, detalheId }: ConfiguracaoContabilDetalheShowServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const detalhe = await s4DotzClient.configuracaoContabilDetalhe.findUnique({
            where: { id: detalheId },
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

        if (!detalhe) {
            throw new AppError("Detalhe da configuração contábil não encontrado", 404);
        }

        if (detalhe.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Detalhe não pertence à configuração informada", 400);
        }

        return formatConfiguracaoContabilDetalhe(detalhe);
    }
}

