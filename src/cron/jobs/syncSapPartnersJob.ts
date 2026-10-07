import log from "@/util/logger";
import apm from "@/apm";
import { CadastroParceirosSapService } from "@/cron/modules/integracao-sap/fornecedor/services/CadastroParceirosSapService";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";

export const syncSapPartnersJob: CronJobDefinition = {
  name: "Sync SAP Partners",
  key: "sync_sap_partners",
  label: "SAP — Busca de parceiros",
  manualTrigger: true,
  schedule: Config.CRON_SYNC_SAP_PARTNERS,
  enabled: Config.CRON_SYNC_SAP_PARTNERS_ENABLED,
  runOnInit: true,
  task: async () => {
    const transaction = apm.startTransaction("Sync SAP Partners", "cron");
    try {
      const service = new CadastroParceirosSapService();

      log.info(`[${syncSapPartnersJob.name}] -- Iniciando sincronização de parceiros SAP`);

      const result = await service.execute();

      log.info(`[${syncSapPartnersJob.name}] Sincronização de parceiros SAP finalizada`);
      log.info(`[${syncSapPartnersJob.name}] Total de parceiros recebidos: ${result.totalReceived}`);
      log.info(`[${syncSapPartnersJob.name}] Total de parceiros inseridos: ${result.inserted}`);
      log.info(`[${syncSapPartnersJob.name}] Total de parceiros atualizados: ${result.updated}`);
    } catch (err) {
      apm.captureError(err as Error);
      throw err;
    } finally {
      transaction?.end();
    } 
  }
};

