/**
 * Factory de configuração por fluxo (PREVISTO/REALIZADO) do envio XTPG.
 * Centraliza spec + view + delegates Prisma + tamanhos de lote, reutilizado pelo
 * cron e pelo reprocessamento.
 */
import s4DotzClient from "@/database/clients/s4DotzClient";
import { Config } from "@/config/config";
import { XtpgViewRepository } from "@/cron/modules/xtpg-envio/repositories/XtpgViewRepository";
import {
    XTPG_SPEC_PREVISTO,
    XTPG_SPEC_REALIZADO,
    type XtpgFlowSpec,
} from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";
import {
    EnviarXtpgBaseService,
    type XtpgEnvioServiceConfig,
} from "@/cron/modules/xtpg-envio/services/EnviarXtpgBaseService";
import type { XtpgFluxo } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

const repository = new XtpgViewRepository();

export function getXtpgFlowConfig(fluxo: XtpgFluxo): XtpgEnvioServiceConfig {
    if (fluxo === "PREVISTO") {
        return {
            fluxo: "PREVISTO",
            spec: XTPG_SPEC_PREVISTO,
            batchSize: Config.XTPG_SEND_PREV_BATCH_SIZE,
            maxPerRun: Config.XTPG_SEND_PREV_MAX_PER_RUN,
            lerView: (max) => repository.lerPrevisto(max),
            headerDelegate: s4DotzClient.xtpgEnvioPrevistoHeader,
            detailDelegate: s4DotzClient.xtpgEnvioPrevistoDetail,
        };
    }
    return {
        fluxo: "REALIZADO",
        spec: XTPG_SPEC_REALIZADO,
        batchSize: Config.XTPG_SEND_FLUX_BATCH_SIZE,
        maxPerRun: Config.XTPG_SEND_FLUX_MAX_PER_RUN,
        lerView: (max) => repository.lerRealizado(max),
        headerDelegate: s4DotzClient.xtpgEnvioRealizadoHeader,
        detailDelegate: s4DotzClient.xtpgEnvioRealizadoDetail,
    };
}

export function getXtpgFlowSpec(fluxo: XtpgFluxo): XtpgFlowSpec {
    return fluxo === "PREVISTO" ? XTPG_SPEC_PREVISTO : XTPG_SPEC_REALIZADO;
}

export function createEnviarXtpgService(fluxo: XtpgFluxo): EnviarXtpgBaseService {
    return new EnviarXtpgBaseService(getXtpgFlowConfig(fluxo));
}
