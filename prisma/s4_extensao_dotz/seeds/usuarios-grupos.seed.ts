import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";

export async function seedUsuariosGrupos(prisma: PrismaClient) {
  const usuarios = await prisma.usuario.findMany({
    where: {
      ativo: true,
    },
  });

  if (usuarios.length === 0) {
    console.debug("Nenhum usuário ativo encontrado. Execute a seed de usuários primeiro.");
    return;
  }

  const grupos = await prisma.grupoUsuario.findMany({
    where: {
      deletadoEm: null,
    },
  });

  if (grupos.length === 0) {
    console.debug("Nenhum grupo de usuário encontrado. Execute a seed de grupos primeiro.");
    return;
  }

  let createdCount = 0;
  const usuariosDisponiveis = [...usuarios];
  const gruposComUsuarios = new Set<number>();

  for (const grupo of grupos) {
    const quantidadeUsuarios = faker.helpers.weightedArrayElement([
      { weight: 0.2, value: 1 },
      { weight: 0.3, value: 2 },
      { weight: 0.3, value: 3 },
      { weight: 0.15, value: 4 },
      { weight: 0.05, value: 5 },
    ]);

    if (usuariosDisponiveis.length === 0) {
      break;
    }

    const usuariosParaGrupo = faker.helpers.arrayElements(
      usuariosDisponiveis,
      Math.min(quantidadeUsuarios, usuariosDisponiveis.length)
    );

    for (const usuario of usuariosParaGrupo) {
      try {
        const relacaoExistente = await prisma.usuarioGrupoUsuario.findUnique({
          where: {
            usuarioId_grupoUsuarioId: {
              usuarioId: usuario.id,
              grupoUsuarioId: grupo.id,
            },
          },
        });

        if (relacaoExistente) {
          continue;
        }

        await prisma.usuarioGrupoUsuario.create({
          data: {
            usuarioId: usuario.id,
            grupoUsuarioId: grupo.id,
            atualizadoPor: 1,
            atualizadoEm: new Date(),
          },
        });

        gruposComUsuarios.add(grupo.id);
        createdCount++;

        const index = usuariosDisponiveis.findIndex((u) => u.id === usuario.id);
        if (index > -1) {
          usuariosDisponiveis.splice(index, 1);
        }
      } catch (error) {
        console.debug(`Erro ao vincular usuário ${usuario.id} ao grupo ${grupo.id}:`, error);
      }
    }
  }

  console.debug(`${createdCount} vínculos de usuários em grupos criados com sucesso.`);
  console.debug(`${gruposComUsuarios.size} grupos receberam usuários.`);
}

