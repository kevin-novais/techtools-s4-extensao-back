import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { ProcessarSaidaXtpgService } from "@/cron/modules/xtpg-saida/services/ProcessarSaidaXtpgService";

export const xtpgProcessarSaidaJob: CronJobDefinition = {
    name: "XTPG Saída (LCM no S/4)",
    key: "xtpg_processar_saida",
    label: "XTPG — Processar saída",
    manualTrigger: true,
    schedule: Config.CRON_XTPG_SAIDA,
    enabled: Config.CRON_XTPG_SAIDA_ENABLED,
    task: async () => {
        const service = new ProcessarSaidaXtpgService();
        log.info(`[${xtpgProcessarSaidaJob.name}] Iniciando processamento da Saída XTPG`);
        const r = await service.execute();
        log.info(
            `[${xtpgProcessarSaidaJob.name}] Concluído: movimentos=${r.totalMovimentos} lotes=${r.totalLotes} ` +
                `lcmCriados=${r.lcmCriados} erros=${r.erros}${r.erroListagem ? ` erroListagem="${r.erroListagem}"` : ""}`,
        );
        return {
            totalReceived: r.totalMovimentos,
            totalUpdated: r.lcmCriados,
        };
    },
};
