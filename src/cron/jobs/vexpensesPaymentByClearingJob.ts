import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { VexpensesPaymentByClearingService } from "@/cron/modules/vexpenses/services/VexpensesPaymentByClearingService";
import log from "@/util/logger";

export const vexpensesPaymentByClearingJob: CronJobDefinition = {
  name: "Vexpenses Payment By Clearing",
  key: "vexpenses_payment_by_clearing",
  label: "Vexpense — Enviar documentos pagos",
  manualTrigger: true,
  schedule: Config.CRON_VEXPENSES_PAYMENT_BY_CLEARING,
  enabled: Config.CRON_VEXPENSES_PAYMENT_BY_CLEARING_ENABLED,
  task: async () => {
    const service = new VexpensesPaymentByClearingService();

    log.info("[VexpensesPaymentByClearingJob] Iniciando processamento de pagamentos por baixa contabil");
    const result = await service.execute();
    log.info("[VexpensesPaymentByClearingJob] Processamento finalizado");
    log.info(
      `[VexpensesPaymentByClearingJob] elegiveis_registros=${result.eligibleRecords}, elegiveis_reports=${result.eligibleReports}, conciliados=${result.matchedReports}, pagos=${result.paidReports}, ignorados=${result.ignoredReports}, erros=${result.errorReports}`,
    );
    return {
      totalReceived: result.eligibleReports,
      totalUpdated: result.paidReports,
    };
  },
};

