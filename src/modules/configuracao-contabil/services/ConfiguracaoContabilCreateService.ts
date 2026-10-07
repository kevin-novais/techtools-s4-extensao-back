import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatConfiguracaoContabil } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import type { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

interface ConfiguracaoContabilPayload {
    tipoProcesso: TipoProcesso;
    tipoDocumentoERP: string;
    ciaId: number;
    periodoDeDiferimento?: number;
    tipoContabilERP: string;
    textoHeaderContabil?: string;
    tipoDocumentoXTPG?: string;
    taxaExpiracao?: number;
}

interface ConfiguracaoContabilCreateServiceParams {
    data: ConfiguracaoContabilPayload;
    usuarioId: number;
}

export class ConfiguracaoContabilCreateService {
    async execute({ data, usuarioId }: ConfiguracaoContabilCreateServiceParams) {
        const ciaExists = await s4DotzClient.cia.findUnique({
            where: { id: data.ciaId },
        });

        if (!ciaExists) {
            throw new AppError("CIA não encontrada", 404);
        }

        const configuracaoExistente = await s4DotzClient.configuracaoContabil.findUnique({
            where: {
                ciaId_tipoProcesso: {
                    ciaId: data.ciaId,
                    tipoProcesso: data.tipoProcesso,
                },
            },
        });

        if (configuracaoExistente) {
            throw new AppError("Configuração contábil já cadastrada para esta CIA e tipoProcesso", 400);
        }

        if (data.tipoProcesso !== "DR" && data.periodoDeDiferimento != null) {
            throw new AppError("Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)", 400);
        }

        const now = new Date();

        const configuracao = await s4DotzClient.configuracaoContabil.create({
            data: {
                tipoProcesso: data.tipoProcesso,
                tipoDocumentoERP: data.tipoDocumentoERP,
                ciaId: data.ciaId,
                periodoDeDiferimento: data.periodoDeDiferimento ?? null,
                tipoContabilERP: data.tipoContabilERP,
                textoHeaderContabil: data.textoHeaderContabil ?? null,
                tipoDocumentoXTPG: data.tipoDocumentoXTPG ?? null,
                taxaExpiracao: data.taxaExpiracao ?? null,
                criadoPor: usuarioId,
                criadoEm: now,
                atualizadoPor: usuarioId,
                atualizadoEm: now,
            },
        });

        return formatConfiguracaoContabil(configuracao);
    }
}
