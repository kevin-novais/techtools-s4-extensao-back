import { Command } from "commander";
import log from "@/util/logger";

function shouldApply(program: Command): boolean {
  const opts = program.opts();
  return Boolean(opts.apply);
}

function createSyncHandler(
  program: Command,
  commandName: string,
  execute: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    if (!shouldApply(program)) {
      log.info(`[DRY-RUN] Comando '${commandName}' seria executado. Use --apply para aplicar.`);
      return;
    }
    await execute();
  };
}

export function registerSyncCommands(program: Command): void {
  const syncCmd = program
    .command("sync")
    .description("Executa sincronizações manualmente");

  syncCmd
    .command("registros-contabeis")
    .description("Sincroniza registros contábeis")
    .action(
      createSyncHandler(program, "sync registros-contabeis", async () => {
        const { SyncRegistrosContabeisService } = await import(
          "@/cron/modules/registros-contabeis/services/SyncRegistrosContabeisService"
        );
        const service = new SyncRegistrosContabeisService();
        log.info("Iniciando sincronização de registros contábeis");
        await service.execute();
      }),
    );

  syncCmd
    .command("sap-partners")
    .description("Sincroniza parceiros SAP")
    .action(
      createSyncHandler(program, "sync sap-partners", async () => {
        const { CadastroParceirosSapService } = await import(
          "@/cron/modules/integracao-sap/fornecedor/services/CadastroParceirosSapService"
        );
        const service = new CadastroParceirosSapService();
        log.info("Iniciando sincronização de parceiros SAP");
        const result = await service.execute();
        log.info("Sincronização de parceiros SAP finalizada");
        log.info(`Total de parceiros recebidos: ${result.totalReceived}`);
        log.info(`Total de parceiros inseridos: ${result.inserted}`);
        log.info(`Total de parceiros atualizados: ${result.updated}`);
      }),
    );

  syncCmd
    .command("vexpenses-reports")
    .description("Processa relatórios aprovados VExpenses")
    .action(
      createSyncHandler(program, "sync vexpenses-reports", async () => {
        const { VexpensesApprovedReportsService } = await import(
          "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService"
        );
        const service = new VexpensesApprovedReportsService();
        log.info("Iniciando processamento de reports aprovados VExpenses");
        const result = await service.execute();
        log.info("Processamento finalizado");
        log.info(`CardCodes: ${Object.keys(result.groupedExpenses).length}`);
        log.info(`Integracoes: ${result.integracoes.length}`);
      }),
    );

  syncCmd
    .command("vexpenses-clearing")
    .description("Processa pagamentos por baixa contábil VExpenses")
    .action(
      createSyncHandler(program, "sync vexpenses-clearing", async () => {
        const { VexpensesPaymentByClearingService } = await import(
          "@/cron/modules/vexpenses/services/VexpensesPaymentByClearingService"
        );
        const service = new VexpensesPaymentByClearingService();
        log.info("Iniciando processamento de pagamentos por baixa contábil VExpenses");
        const result = await service.execute();
        log.info("Processamento finalizado");
        log.info(
          `elegiveis_registros=${result.eligibleRecords}, elegiveis_reports=${result.eligibleReports}, conciliados=${result.matchedReports}, pagos=${result.paidReports}, ignorados=${result.ignoredReports}, erros=${result.errorReports}`,
        );
      }),
    );
}
