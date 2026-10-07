import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { EnviarRealizadoXtpgService } from "@/cron/modules/xtpg-envio/services/EnviarRealizadoXtpgService";

export const xtpgEnviarRealizadoJob: CronJobDefinition = {
    name: "XTPG Enviar Realizado (SendFlux)",
    key: "xtpg_enviar_realizado",
    label: "XTPG — Envio realizado",
    manualTrigger: true,
    schedule: Config.CRON_XTPG_SEND_FLUX,
    enabled: Config.CRON_XTPG_SEND_FLUX_ENABLED,
    task: async () => {
        const service = new EnviarRealizadoXtpgService();
        log.info(`[${xtpgEnviarRealizadoJob.name}] Iniciando envio realizado XTPG`);
        const result = await service.execute();
        log.info(
            `[${xtpgEnviarRealizadoJob.name}] Concluído: lidos=${result.totalLidos} lotes=${result.totalLotes} enviados=${result.totalEnviados} erros=${result.totalErros}`,
        );
        return {
          totalReceived: result.totalLidos,
          totalUpdated: result.totalEnviados,
        };
    },
};
