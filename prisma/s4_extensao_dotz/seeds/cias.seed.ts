import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";

export async function seedCias(prisma: PrismaClient) {
  const existingCiasCount = await prisma.cia.count();

  if (existingCiasCount > 0) {
    console.debug(`Já existem ${existingCiasCount} CIAs. Seed de CIAs fictícias não executado.`);
    return;
  }

  let createdCount = 0;
  const ciasParaCriar = 30;

  for (let i = 0; i < ciasParaCriar; i++) {
    try {
      const nome = faker.company.name();

      const ciaExistente = await prisma.cia.findFirst({
        where: { nome },
      });

      if (ciaExistente) {
        console.debug(`CIA com nome ${nome} já existe. Pulando...`);
        continue;
      }

      await prisma.cia.create({
        data: {
          nome,
          atualizadoPor: 1,
          atualizadoEm: new Date(),
        },
      });

      createdCount++;
    } catch (error) {
      console.debug(`Erro ao criar CIA ${i + 1}:`, error);
    }
  }

  console.debug(`${createdCount} CIAs fictícias criadas com sucesso.`);
}

