import dotenv from "dotenv";
import DatabaseManager from "../../src/database/DatabaseManager";
import { seedGruposOCRD } from "./seeds/populate-grupos-ocrd.seed";

dotenv.config();

const DEVELOPMENT_MODE = process.env.DEVELOPMENT_MODE || false;
console.debug("DEVELOPMENT_MODE:", DEVELOPMENT_MODE);

async function main() {
  if (!DEVELOPMENT_MODE) {
    console.log("Seed não executado: DEVELOPMENT_MODE está desabilitado");
    return;
  }

  const prisma = DatabaseManager.getDotzStageClient();

  await seedGruposOCRD(prisma);
}

// eslint-disable-next-line @typescript-eslint/prefer-top-level-await
(async () => {
  try {
    await main();
  } catch (e) {
    console.debug("Erro ao executar seed:", e);
    process.exit(1);
  } finally {
    await DatabaseManager.disconnectAll();
  }
})();

