import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface ConfiguracaoContabilDetalheDeleteServiceParams {
    configuracaoContabilId: number;
    detalheId: number;
}

export class ConfiguracaoContabilDetalheDeleteService {
    async execute({ configuracaoContabilId, detalheId }: ConfiguracaoContabilDetalheDeleteServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const detalhe = await s4DotzClient.configuracaoContabilDetalhe.findUnique({
            where: { id: detalheId },
        });

        if (!detalhe) {
            throw new AppError("Detalhe da configuração contábil não encontrado", 404);
        }

        if (detalhe.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Detalhe não pertence à configuração informada", 400);
        }

        await s4DotzClient.configuracaoContabilDetalhe.delete({
            where: { id: detalheId },
        });

        return {
            message: "Detalhe da configuração contábil removido com sucesso",
        };
    }
}

