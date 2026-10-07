import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";

export async function seedGruposUsuario(prisma: PrismaClient) {
  const existingGruposCount = await prisma.grupoUsuario.count();

  if (existingGruposCount > 0) {
    console.debug(`Já existem ${existingGruposCount} grupos de usuários. Seed de grupos não executado.`);
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

  let createdCount = 0;
  const gruposParaCriar = 20;

  for (let i = 0; i < gruposParaCriar; i++) {
    try {
      const nome = `Grupo ${faker.company.buzzNoun()} ${faker.number.int({ min: 1, max: 999 })}`;
      const ciaAleatoria = faker.helpers.arrayElement(cias);
      
      // Criar datas sem horário (apenas dia/mês/ano)
      const dataInicioTemp = faker.date.past({ years: 1 });
      const dataInicio = new Date(dataInicioTemp.getFullYear(), dataInicioTemp.getMonth(), dataInicioTemp.getDate());
      
      const dataFimTemp = faker.date.future({ years: 1, refDate: dataInicio });
      const dataFim = new Date(dataFimTemp.getFullYear(), dataFimTemp.getMonth(), dataFimTemp.getDate());
      
      const aprovaDivergencia = faker.datatype.boolean();

      const grupoExistente = await prisma.grupoUsuario.findFirst({
        where: { nome },
      });

      if (grupoExistente) {
        console.debug(`Grupo com nome ${nome} já existe. Pulando...`);
        continue;
      }

      await prisma.grupoUsuario.create({
        data: {
          nome,
          ciaId: ciaAleatoria.id,
          dataInicio,
          dataFim,
          aprovaDivergencia,
          atualizadoPor: 1,
          atualizadoEm: new Date(),
        },
      });

      createdCount++;
    } catch (error) {
      console.debug(`Erro ao criar grupo ${i + 1}:`, error);
    }
  }

  console.debug(`${createdCount} grupos de usuários criados com sucesso.`);
}

