import log from "@/util/logger";
import apm from "@/apm";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { SyncRegistrosContabeisService } from "@/cron/modules/registros-contabeis/services/SyncRegistrosContabeisService";

export const syncRegistrosContabeisJob: CronJobDefinition = {
  name: "Sync Registros Contabeis",
  key: "sync_registros_contabeis",
  label: "SAP — Busca de registros contábeis",
  manualTrigger: true,
  schedule: Config.CRON_SYNC_REGISTROS_CONTABEIS,
  enabled: Config.CRON_SYNC_REGISTROS_CONTABEIS_ENABLED,
  runOnInit: true,
  task: async () => {
    const transaction = apm.startTransaction("Sync Registros Contabeis", "cron");
    try {
      const service = new SyncRegistrosContabeisService();

      log.info("Iniciando sincronização de registros contábeis");

      await service.execute();
    } catch (err) {
      apm.captureError(err as Error);
      throw err;
    } finally {
      transaction?.end();
    }
  },
};
