import { PrismaClient } from "@prisma/client-s4-dotz";
import bcrypt from "bcrypt";
import { Perfil } from "../../../src/@types/PermissionsTypes";

export async function seedAdmin(prisma: PrismaClient) {
  const email = "admin@teste.com";
  const nome = "GRA TESTE";
  const senha = "admin";
  const perfil = Perfil.ADMIN;
  const ativo = true;
  const atualizadoPor = 1;

  const userExist = await prisma.usuario.findUnique({
    where: {
      email,
    },
  });

  if (userExist) {
    console.debug(`Usuário com email ${email} já existe. Seed não executado.`);
    return;
  }

  const hashed = await bcrypt.hash(senha, 10);

  const user = await prisma.usuario.create({
    data: {
      email,
      nome,
      senha: hashed,
      perfil,
      ativo,
      atualizadoPor,
      atualizadoEm: new Date(),
    },
  });

  console.debug(`Usuário admin criado com sucesso:`, {
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    ativo: user.ativo,
  });
}

