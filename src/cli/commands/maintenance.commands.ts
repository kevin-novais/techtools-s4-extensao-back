import { Command } from "commander";

function shouldApply(program: Command): boolean {
  const opts = program.opts();
  return Boolean(opts.apply);
}

export function registerMaintenanceCommands(program: Command): void {
  const maintenanceCmd = program
    .command("maintenance")
    .description("Comandos de manutenção");

  maintenanceCmd
    .command("backfill-documento-fiscal-urls")
    .description(
      "Migra file_url/relatorio_pdf/relatorio_xlsx existentes para o novo formato de path relativo + nome tratado em documento_fiscal_header"
    )
    .action(async () => {
      const apply = shouldApply(program);
      const { backfillDocumentoFiscalUrls } = await import("@/cli/commands/backfillDocumentoFiscalUrls");
      await backfillDocumentoFiscalUrls(apply);
    });
}
