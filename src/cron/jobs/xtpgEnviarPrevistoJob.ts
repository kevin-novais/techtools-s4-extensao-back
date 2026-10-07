import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { EnviarPrevistoXtpgService } from "@/cron/modules/xtpg-envio/services/EnviarPrevistoXtpgService";

export const xtpgEnviarPrevistoJob: CronJobDefinition = {
    name: "XTPG Enviar Previsto (SendPrev)",
    key: "xtpg_enviar_previsto",
    label: "XTPG — Envio previsto",
    manualTrigger: true,
    schedule: Config.CRON_XTPG_SEND_PREV,
    enabled: Config.CRON_XTPG_SEND_PREV_ENABLED,
    task: async () => {
        const service = new EnviarPrevistoXtpgService();
        log.info(`[${xtpgEnviarPrevistoJob.name}] Iniciando envio previsto XTPG`);
        const result = await service.execute();
        log.info(
            `[${xtpgEnviarPrevistoJob.name}] Concluído: lidos=${result.totalLidos} lotes=${result.totalLotes} enviados=${result.totalEnviados} erros=${result.totalErros}`,
        );
        return {
          totalReceived: result.totalLidos,
          totalUpdated: result.totalEnviados,
        };
    },
};
