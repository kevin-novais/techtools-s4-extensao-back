import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { TrocaDetectReversaoSapService } from "@/modules/documento-fiscal/cancelamento/services/TrocaDetectReversaoSapService";

export const detectTrocaReversaoSapJob: CronJobDefinition = {
    name: "Detect Troca Reversao SAP",
    key: "detect_troca_reversao_sap",
    label: "Trocas — Detectar cancelamento no SAP",
    manualTrigger: true,
    schedule: Config.CRON_DETECT_TROCA_REVERSAO_SAP,
    enabled: Config.CRON_DETECT_TROCA_REVERSAO_SAP_ENABLED,
    task: async () => {
        const service = new TrocaDetectReversaoSapService();

        log.info(`[${detectTrocaReversaoSapJob.name}] Iniciando detecção de cancelamentos de troca no SAP`);

        const result = await service.execute();

        log.info(`[${detectTrocaReversaoSapJob.name}] JEs de reversão encontrados no SAP: ${result.totalReversoesSap}`);
        log.info(`[${detectTrocaReversaoSapJob.name}] Romaneios de troca cancelados: ${result.totalHeadersCancelados}`);
        return {
            totalReceived: result.totalReversoesSap,
            totalUpdated: result.totalHeadersCancelados,
        };
    },
};
