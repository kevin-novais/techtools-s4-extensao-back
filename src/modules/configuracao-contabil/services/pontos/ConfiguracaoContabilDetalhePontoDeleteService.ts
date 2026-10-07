import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface ConfiguracaoContabilDetalhePontoDeleteServiceParams {
    configuracaoContabilId: number;
    pontoId: number;
}

export class ConfiguracaoContabilDetalhePontoDeleteService {
    async execute({ configuracaoContabilId, pontoId }: ConfiguracaoContabilDetalhePontoDeleteServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const ponto = await s4DotzClient.configuracaoContabilDetalhePonto.findUnique({
            where: { id: pontoId },
        });

        if (!ponto) {
            throw new AppError("Ponto da configuração contábil não encontrado", 404);
        }

        if (ponto.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Ponto não pertence à configuração informada", 400);
        }

        await s4DotzClient.configuracaoContabilDetalhePonto.delete({
            where: { id: pontoId },
        });

        return {
            message: "Ponto da configuração contábil removido com sucesso",
        };
    }
}
