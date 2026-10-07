import DatabaseManager from "../../src/database/DatabaseManager";
import { seedAdmin } from "./seeds/admin.seed";
import { seedFakeUsers } from "./seeds/fake-users.seed";
import { seedCias } from "./seeds/cias.seed";
import { seedGruposUsuario } from "./seeds/grupos-usuario.seed";
import { seedUsuariosGrupos } from "./seeds/usuarios-grupos.seed";
import { seedConfiguracaoContabil } from "./seeds/configuracao-contabil.seed";
import { seedConfiguracaoContabilDetalhe } from "./seeds/configuracao-contabil-detalhe.seed";
import { seedVendasHeader } from "./seeds/vendas-header.seed";
import { seedVendasDetalhe } from "./seeds/vendas-detalhe.seed";

const DEVELOPMENT_MODE = process.env.DEVELOPMENT_MODE || false;
console.debug("DEVELOPMENT_MODE:", DEVELOPMENT_MODE);

async function main() {
  if (!DEVELOPMENT_MODE) {
    console.debug("Seed não executado: DEVELOPMENT_MODE está desabilitado");
    return;
  }

  const prisma = DatabaseManager.getS4DotzClient();

  await seedAdmin(prisma);
  // await seedFakeUsers(prisma);
  // await seedCias(prisma);
  // await seedGruposUsuario(prisma);
  // await seedUsuariosGrupos(prisma);
  // await seedConfiguracaoContabil(prisma);
  // await seedConfiguracaoContabilDetalhe(prisma);
  // await seedVendasHeader(prisma);
  // await seedVendasDetalhe(prisma);
}

// Top-level await não é suportado com CommonJS, usando IIFE async como alternativa
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
