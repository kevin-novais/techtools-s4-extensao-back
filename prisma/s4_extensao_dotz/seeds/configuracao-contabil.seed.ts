import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";
import { TipoDocumentoERP } from "../../../src/@types/ConfiguracaoContabil/ProcessoTypes";

const tipoDocumentoParaSAP: Record<string, string> = {
  [TipoDocumentoERP.TP_ROM]: "RE",
  [TipoDocumentoERP.TP_POS]: "RE",
  [TipoDocumentoERP.PD]: "PD",
  [TipoDocumentoERP.DR]: "DR",
  [TipoDocumentoERP.RD]: "RD",
};

export async function seedConfiguracaoContabil(prisma: PrismaClient) {
  const existingConfigsCount = await prisma.configuracaoContabil.count();

  if (existingConfigsCount > 0) {
    console.debug(
      `Já existem ${existingConfigsCount} configurações contábeis. Seed não executado.`
    );
    return;
  }

  const cias = await prisma.cia.findMany({
    where: {
      deletadoEm: null,
    },
  });

  if (cias.length === 0) {
    console.debug("Nenhuma CIA encontrada. Execute a seed de CIAs primeiro.");
    return;
  }

  const tiposDocumentoERP = Object.values(TipoDocumentoERP);

  // Textos header contábil por processo (máx. 25 caracteres)
  const textosHeaderPorTipoDocumentoERP = {
    TP_ROM: "Troca pts - Romaneio",
    TP_POS: "Troca pts - POS",
    DR: "Venda de pontos",
    PD: "Promo Dotz",
    RD: "Receitas diferidas",
  };

  // Exemplos de tipos de documento ERP para seed
  const tiposContabilExemplos = ["AP", "AR", "GL", "DOC01", "DOC02", "TIPO_A"];

  let createdCount = 0;

  // Criar 1 configuração por tipoDocumentoERP para cada CIA
  for (const cia of cias) {
    for (const tipoDocumentoERP of tiposDocumentoERP) {
      try {
        // Verificar se já existe configuração para esta CIA e tipoDocumentoERP
        const configExistente = await prisma.configuracaoContabil.findUnique({
          where: {
            ciaId_tipoDocumentoERP: {
              ciaId: cia.id,
              tipoDocumentoERP,
            },
          },
        });

        if (configExistente) {
          console.debug(
            `Configuração já existe para CIA ${cia.id} e tipoDocumentoERP ${tipoDocumentoERP}. Pulando...`
          );
          continue;
        }

        // Período de diferimento: apenas para tipo DR (Venda de Pontos). Inclui 0 como valor válido.
        const periodoDeDiferimento =
          tipoDocumentoERP === TipoDocumentoERP.DR && faker.datatype.boolean({ probability: 0.5 })
            ? faker.helpers.arrayElement([0, 12, 24, 36])
            : null;

        // Tipo de documento ERP - texto livre
        const tipoContabilERP = faker.helpers.arrayElement(tiposContabilExemplos);

        // Texto header contábil: 80% das vezes usa o padrão do processo
        const textoHeaderContabil = faker.datatype.boolean({ probability: 0.8 })
          ? textosHeaderPorTipoDocumentoERP[tipoDocumentoERP as keyof typeof textosHeaderPorTipoDocumentoERP]
          : null;

        await prisma.configuracaoContabil.create({
          data: {
            tipoDocumentoERP,
            tipoDocumento: tipoDocumentoParaSAP[tipoDocumentoERP],
            ciaId: cia.id,
            periodoDeDiferimento,
            tipoContabilERP: tipoContabilERP.trim(),
            textoHeaderContabil,
            criadoPor: 1,
            criadoEm: new Date(),
            atualizadoPor: 1,
            atualizadoEm: new Date(),
          },
        });

        createdCount++;
      } catch (error) {
        console.debug(
          `Erro ao criar configuração contábil para CIA ${cia.id} e tipoDocumentoERP ${tipoDocumentoERP}:`,
          error
        );
      }
    }
  }

  console.debug(
    `${createdCount} configurações contábeis criadas com sucesso.`
  );
}

