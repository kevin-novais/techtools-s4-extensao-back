import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { DeduzirItemFluxoCaixaXtpgService } from "@/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService";

export const classificacaoFluxoCaixaXtpgJob: CronJobDefinition = {
    name: "Classificação fluxo de caixa XTPG",
    key: "classificacao_fluxo_caixa_xtpg",
    label: "XTPG — Classificação de fluxo de Caixa",
    manualTrigger: true,
    schedule: Config.CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG,
    enabled: Config.CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED,
    task: async () => {
        const service = new DeduzirItemFluxoCaixaXtpgService();
        log.info(`[${classificacaoFluxoCaixaXtpgJob.name}] Iniciando lote de classificação XTPG`);
        const result = await service.execute();
        log.info(
            `[${classificacaoFluxoCaixaXtpgJob.name}] Concluído: processadas=${result.processed} classificadas=${result.classified} erros=${result.errorsSet} já_válidas=${result.skippedAlreadyValid}`,
        );
    },
};
