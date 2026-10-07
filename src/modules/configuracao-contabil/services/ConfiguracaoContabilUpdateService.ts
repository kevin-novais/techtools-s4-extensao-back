import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatConfiguracaoContabil } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import type { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

interface ConfiguracaoContabilUpdatePayload {
    tipoProcesso?: TipoProcesso;
    tipoDocumentoERP?: string;
    ciaId?: number;
    periodoDeDiferimento?: number | null;
    tipoContabilERP?: string;
    textoHeaderContabil?: string | null;
    tipoDocumentoXTPG?: string | null;
    taxaExpiracao?: number | null;
}

interface ConfiguracaoContabilUpdateServiceParams {
    id: number;
    data: ConfiguracaoContabilUpdatePayload;
    usuarioId: number;
}

const hasValue = <T>(value: T | undefined): value is T =>
    value !== undefined;

export class ConfiguracaoContabilUpdateService {
    async execute({ id, data, usuarioId }: ConfiguracaoContabilUpdateServiceParams) {
        const configuracao = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id },
        });

        if (!configuracao) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const ciaIdAtual = hasValue(data.ciaId) ? data.ciaId : configuracao.ciaId;
        const tipoProcessoAtual = hasValue(data.tipoProcesso) ? data.tipoProcesso : configuracao.tipoProcesso;

        if (tipoProcessoAtual !== "DR" && hasValue(data.periodoDeDiferimento) && data.periodoDeDiferimento !== null) {
            throw new AppError("Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)", 400);
        }

        if (tipoProcessoAtual !== "DR" && hasValue(data.tipoDocumentoXTPG) && data.tipoDocumentoXTPG !== null) {
            throw new AppError("Tipo do documento XTPG é permitido apenas para o tipo DR (Venda de Pontos)", 400);
        }

        if (hasValue(data.ciaId)) {
            const ciaExists = await s4DotzClient.cia.findUnique({
                where: { id: data.ciaId },
            });

            if (!ciaExists) {
                throw new AppError("CIA não encontrada", 404);
            }
        }

        if ((hasValue(data.ciaId) || hasValue(data.tipoProcesso)) && (ciaIdAtual !== configuracao.ciaId || tipoProcessoAtual !== configuracao.tipoProcesso)) {
            const conflito = await s4DotzClient.configuracaoContabil.findUnique({
                where: {
                    ciaId_tipoProcesso: {
                        ciaId: ciaIdAtual,
                        tipoProcesso: tipoProcessoAtual,
                    },
                },
            });

            if (conflito && conflito.id !== id) {
                throw new AppError("Já existe uma configuração contábil com esta CIA e tipoProcesso", 400);
            }
        }

        const now = new Date();

        const updateData = {
            ...(hasValue(data.tipoProcesso) ? { tipoProcesso: data.tipoProcesso } : {}),
            ...(hasValue(data.tipoDocumentoERP) ? { tipoDocumentoERP: data.tipoDocumentoERP } : {}),
            ...(hasValue(data.ciaId) ? { ciaId: data.ciaId } : {}),
            ...(() => {
                if (tipoProcessoAtual !== "DR") {
                    if (hasValue(data.tipoProcesso) || hasValue(data.periodoDeDiferimento)) {
                        return { periodoDeDiferimento: null };
                    }
                    return {};
                }
                return hasValue(data.periodoDeDiferimento) ? { periodoDeDiferimento: data.periodoDeDiferimento } : {};
            })(),
            ...(hasValue(data.tipoContabilERP) ? { tipoContabilERP: data.tipoContabilERP } : {}),
            ...(hasValue(data.textoHeaderContabil) ? { textoHeaderContabil: data.textoHeaderContabil ?? null } : {}),
            ...(hasValue(data.tipoDocumentoXTPG) ? { tipoDocumentoXTPG: data.tipoDocumentoXTPG ?? null } : {}),
            ...(hasValue(data.taxaExpiracao) ? { taxaExpiracao: data.taxaExpiracao ?? null } : {}),
            atualizadoPor: usuarioId,
            atualizadoEm: now,
        };

        const configuracaoAtualizada = await s4DotzClient.configuracaoContabil.update({
            where: { id },
            data: updateData,
        });

        return formatConfiguracaoContabil(configuracaoAtualizada);
    }
}
