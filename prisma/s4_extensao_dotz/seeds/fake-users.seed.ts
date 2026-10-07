import { PrismaClient } from "@prisma/client-s4-dotz";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import { Perfil } from "../../../src/@types/PermissionsTypes";

export async function seedFakeUsers(prisma: PrismaClient) {
  const existingUsersCount = await prisma.usuario.count();
  
  if (existingUsersCount >= 50) {
    console.debug(`Já existem ${existingUsersCount} usuários. Seed de usuários fictícios não executado.`);
    return;
  }

  const senhaPadrao = "123456";
  const senhaHash = await bcrypt.hash(senhaPadrao, 10);

  let createdCount = 0;
  const usuariosParaCriar = 50;

  for (let i = 0; i < usuariosParaCriar; i++) {
    try {
      const email = faker.internet.email().toLowerCase().trim();
      const nome = faker.person.fullName();

      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        console.debug(`Email ${email} já existe. Pulando...`);
        continue;
      }

      await prisma.usuario.create({
        data: {
          email,
          nome,
          senha: senhaHash,
          perfil: Perfil.USER,
          ativo: true,
          atualizadoPor: 1,
          atualizadoEm: new Date(),
        },
      });

      createdCount++;
    } catch (error) {
      console.debug(`Erro ao criar usuário ${i + 1}:`, error);
    }
  }

  console.debug(`${createdCount} usuários fictícios criados com sucesso.`);
}

