import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { SYSTEM_USER_ID } from "./db";

const FAST_BCRYPT_ROUNDS = 4;

interface CreateUsuarioParams {
    email?: string;
    nome?: string;
    senhaPlain?: string;
    perfil?: "ADMIN" | "USER";
    ativo?: boolean;
    atualizadoPor?: number;
}

export async function createUsuario(params: CreateUsuarioParams = {}) {
    const senhaPlain = params.senhaPlain ?? "Test@1234";
    const senha = await bcrypt.hash(senhaPlain, FAST_BCRYPT_ROUNDS);

    const usuario = await s4DotzClient.usuario.create({
        data: {
            email: params.email ?? faker.internet.email().toLowerCase(),
            nome: params.nome ?? faker.person.fullName(),
            senha,
            perfil: params.perfil ?? "ADMIN",
            ativo: params.ativo ?? true,
            atualizadoPor: params.atualizadoPor ?? SYSTEM_USER_ID,
        },
    });

    return { ...usuario, senhaPlain };
}

interface CreateCiaParams {
    nome?: string;
    ciaIdSAP?: string;
    cpfCnpj?: string;
    atualizadoPor: number;
}

export async function createCia(params: CreateCiaParams) {
    return s4DotzClient.cia.create({
        data: {
            nome: params.nome ?? `CIA ${faker.company.name()}`,
            ciaIdSAP: params.ciaIdSAP ?? faker.string.numeric(4),
            cpfCnpj: params.cpfCnpj ?? faker.string.numeric(14),
            atualizadoPor: params.atualizadoPor,
        },
    });
}

interface CreateGrupoUsuarioParams {
    ciaId: number;
    nome?: string;
    aprovaDivergencia?: boolean;
    atualizadoPor: number;
}

export async function createGrupoUsuario(params: CreateGrupoUsuarioParams) {
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);

    return s4DotzClient.grupoUsuario.create({
        data: {
            ciaId: params.ciaId,
            nome: params.nome ?? `Grupo-${faker.string.alphanumeric(8)}`,
            dataInicio: today,
            dataFim: oneYearFromNow,
            aprovaDivergencia: params.aprovaDivergencia ?? false,
            atualizadoPor: params.atualizadoPor,
        },
    });
}

interface CreateUsuarioComAcessoCiaParams {
    ciaId: number;
    perfil?: "ADMIN" | "USER";
    seedUsuarioId: number;
}

export async function createUsuarioComAcessoCia(params: CreateUsuarioComAcessoCiaParams) {
    const usuario = await createUsuario({
        perfil: params.perfil,
        atualizadoPor: params.seedUsuarioId,
    });

    const grupo = await createGrupoUsuario({
        ciaId: params.ciaId,
        atualizadoPor: params.seedUsuarioId,
    });

    await s4DotzClient.usuarioGrupoUsuario.create({
        data: {
            usuarioId: usuario.id,
            grupoUsuarioId: grupo.id,
            atualizadoPor: params.seedUsuarioId,
        },
    });

    return { usuario, grupo };
}
