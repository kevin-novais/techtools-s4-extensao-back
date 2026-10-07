import dotenv from "dotenv";
import { Command } from "commander";
import DatabaseManager from "@/database/DatabaseManager";
import { registerSyncCommands } from "@/cli/commands/sync.commands";
import { registerMaintenanceCommands } from "@/cli/commands/maintenance.commands";

dotenv.config();

class AppCommander {
  private readonly program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  async execute(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } finally {
      await DatabaseManager.disconnectAll();
    }
  }

  private setupProgram(): void {
    this.program
      .name("dotz-commands")
      .description("CLI para comandos de manutenção e sincronização do S4 Extensão Dotz")
      .version("1.0.0")
      .option("--dry-run", "Pré-visualização: mostra o que seria feito sem executar")
      .option("--apply", "Executa as alterações (sem isso, roda em dry-run por padrão)");

    registerSyncCommands(this.program);
    registerMaintenanceCommands(this.program);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await, @typescript-eslint/prefer-top-level-await -- CommonJS não suporta top-level await
void (async () => {
  try {
    await new AppCommander().execute();
  } catch (error) {
    console.error("[COMMANDER] Erro ao executar comando:", error);
    process.exit(1);
  }
})();
