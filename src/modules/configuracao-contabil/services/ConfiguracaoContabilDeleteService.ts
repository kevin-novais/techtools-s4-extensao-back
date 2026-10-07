import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export class ConfiguracaoContabilDeleteService {
    async execute(id: number) {
        const configuracao = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id },
        });

        if (!configuracao) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        await s4DotzClient.configuracaoContabil.delete({
            where: { id },
        });

        return {
            message: "Configuração contábil removida com sucesso",
        };
    }
}


