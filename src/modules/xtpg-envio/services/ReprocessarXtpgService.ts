/**
 * Reprocessamento de envios XTPG (acionado pela tela).
 *
 * Elegibilidade: somente movimentos com DETAIL status = ERRO ou cujo registro está
 * preso em 'P' (processando). Modos:
 *  - "resetar":  zera registros_contabeis.status_para_envio (+id_xrt) -> o cron reenvia depois.
 *  - "reenviar": reconstrói o movimento a partir do DETAIL e reenvia agora (novo log + write-back).
 */
import log from "@/util/logger";
import AppError from "@/util/AppError";
import s4DotzClient from "@/database/clients/s4DotzClient";
import {
    buildMovimentoFromDetail,
    parseChaveRegistro,
} from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";
import {
    createEnviarXtpgService,
    getXtpgFlowSpec,
} from "@/cron/modules/xtpg-envio/services/xtpgEnvioFactory";
import { getLogDelegates, loadRegistroStatusByChaves } from "@/modules/xtpg-envio/utils/registroStatus";
import {
    XTPG_DETAIL_STATUS,
    buildStatusParaEnvio,
    type XtpgFluxo,
} from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

export type ReprocessarModo = "reenviar" | "resetar";

export interface ReprocessarXtpgParams {
    fluxo: XtpgFluxo;
    detailIds: number[];
    modo: ReprocessarModo;
}

export class ReprocessarXtpgService {
    async execute(params: ReprocessarXtpgParams) {
        const { fluxo, detailIds, modo } = params;
        const { detail } = getLogDelegates(fluxo);

        const detalhes: Array<Record<string, unknown>> = await detail.findMany({
            where: { id: { in: detailIds } },
        });
        if (detalhes.length === 0) {
            throw new AppError("Nenhum movimento encontrado para os IDs informados.", 404);
        }

        const statusMap = await loadRegistroStatusByChaves(
            detalhes.map((d) => d.origemDocEntry as string | null),
        );

        const elegiveis = detalhes.filter((d) => {
            const chave = d.origemDocEntry as string | null;
            const registroStatus = chave ? statusMap.get(chave) ?? null : null;
            return (
                d.status === XTPG_DETAIL_STATUS.ERRO ||
                registroStatus === buildStatusParaEnvio(fluxo, "PROCESSANDO")
            );
        });
        const ignorados = detalhes.length - elegiveis.length;

        if (elegiveis.length === 0) {
            throw new AppError(
                "Nenhum movimento elegível para reprocessamento (somente status ERRO ou registros em 'P').",
                422,
            );
        }

        if (modo === "resetar") {
            const resetados = await this.resetar(elegiveis);
            log.info(`[ReprocessarXtpg:${fluxo}] resetar: ${resetados} registro(s), ${ignorados} ignorado(s).`);
            return { fluxo, modo, elegiveis: elegiveis.length, resetados, ignorados };
        }

        // reenviar
        const spec = getXtpgFlowSpec(fluxo);
        const movimentos = elegiveis.map((d) => buildMovimentoFromDetail(d, spec));
        const resumo = await createEnviarXtpgService(fluxo).processar(movimentos);
        log.info(
            `[ReprocessarXtpg:${fluxo}] reenviar: enviados=${resumo.totalEnviados} erros=${resumo.totalErros} ignorados=${ignorados}.`,
        );
        return { fluxo, modo, elegiveis: elegiveis.length, ignorados, ...resumo };
    }

    private async resetar(detalhes: Array<Record<string, unknown>>): Promise<number> {
        let resetados = 0;
        for (const d of detalhes) {
            const pk = parseChaveRegistro(d.origemDocEntry as string | null);
            if (!pk) continue;
            try {
                await s4DotzClient.accountingDocumentItem.update({
                    where: { CompanyCode_FiscalYear_AccountingDocument_AccountingDocumentItem: pk },
                    data: { StatusParaEnvio: null, IdXRT: null },
                });
                resetados += 1;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error(`[ReprocessarXtpg] Falha ao resetar ${d.origemDocEntry}: ${msg}`);
            }
        }
        return resetados;
    }
}
