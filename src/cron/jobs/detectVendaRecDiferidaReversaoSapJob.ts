import log from "@/util/logger";
import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import { VendaRecDiferidaDetectReversaoSapService } from "@/modules/vendas/services/VendaRecDiferidaDetectReversaoSapService";

export const detectVendaRecDiferidaReversaoSapJob: CronJobDefinition = {
    name: "Detect VendaRecDiferida Reversao SAP",
    key: "detect_venda_rec_diferida_reversao_sap",
    label: "Vendas — Detectar reversão no SAP",
    manualTrigger: true,
    schedule: Config.CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP,
    enabled: Config.CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP_ENABLED,
    task: async () => {
        const service = new VendaRecDiferidaDetectReversaoSapService();

        log.info(`[${detectVendaRecDiferidaReversaoSapJob.name}] Iniciando detecção de reversões SAP para receitas diferidas`);

        const result = await service.execute();

        log.info(`[${detectVendaRecDiferidaReversaoSapJob.name}] JEs de reversão encontrados no SAP: ${result.totalReversoesSap}`);
        log.info(`[${detectVendaRecDiferidaReversaoSapJob.name}] Parcelas enfileiradas para reversão: ${result.totalParcelasEnfileiradas}`);
        return {
          totalReceived: result.totalReversoesSap,
          totalUpdated: result.totalParcelasEnfileiradas,
        };
    },
};
