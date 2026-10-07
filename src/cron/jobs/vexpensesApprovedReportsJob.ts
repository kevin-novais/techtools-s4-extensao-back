import log from "@/util/logger";
import apm from "@/apm";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

export const vexpensesApprovedReportsJob: CronJobDefinition = {
  name: "Vexpenses Approved Reports",
  key: "vexpenses_approved_reports",
  label: "Vexpense — Buscar reports aprovados",
  manualTrigger: true,
  schedule: Config.CRON_VEXPENSES_APPROVED_REPORTS,
  enabled: Config.CRON_VEXPENSES_APPROVED_REPORTS_ENABLED,
  runOnInit: true,
  task: async () => {
    const transaction = apm.startTransaction("Vexpenses Approved Reports", "cron");
    try {
      const service = new VexpensesApprovedReportsService();

      log.info("[VexpensesApprovedReportsJob] Iniciando processamento de reports aprovados");

      const result = await service.execute();

      log.info("[VexpensesApprovedReportsJob] Processamento finalizado");
      log.info(`[VexpensesApprovedReportsJob] CardCodes=${Object.keys(result.groupedExpenses).length}`);
      log.info(`[VexpensesApprovedReportsJob] Integracoes=${result.integracoes.length}`);
      return {
        totalReceived: Object.keys(result.groupedExpenses).length,
        totalUpdated: result.integracoes.length,
      };
    } catch (err) {
      apm.captureError(err as Error);
      throw err;
    } finally {
      transaction?.end();
    }
  },
};
