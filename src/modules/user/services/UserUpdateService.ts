import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import bcrypt from "bcrypt";
import { formatDateToBrazilianTimezone } from "@/util/date";


interface UserUpdateServiceProps {
    email?: string;
    senhaAtual?: string;
    senhaNova?: string;
    nome?: string;
}

export class UserUpdateService {
    async execute(userId: number, data: UserUpdateServiceProps) {
        const { email, senhaAtual, senhaNova, nome } = data;
        
        const userExist = await s4DotzClient.usuario.findUnique({
            where: { id: userId },
        });

        if (!userExist) {
            throw new AppError("Usuário não encontrado", 404);
        }

        const updateData: {
            email?: string;
            nome?: string;
            senha?: string;
        } = {};

        if (email !== undefined) {
            if (email !== userExist.email) {
                const emailExists = await s4DotzClient.usuario.findUnique({
                    where: { email },
                });

                if (emailExists) {
                    throw new AppError("Email já cadastrado", 400);
                }
            }
            updateData.email = email;
        }

        if (nome !== undefined) {
            updateData.nome = nome;
        }

        if (senhaNova !== undefined) {
            if (!senhaAtual) {
                throw new AppError("Senha atual é obrigatória para alterar a senha", 400);
            }

            const isCurrentPasswordValid = await bcrypt.compare(senhaAtual, userExist.senha);
            if (!isCurrentPasswordValid) {
                throw new AppError("Senha atual incorreta", 401);
            }

            updateData.senha = await bcrypt.hash(senhaNova, 10);
        }

        const user = await s4DotzClient.usuario.update({
            where: { id: userId },
            data: {
                ...updateData,
                atualizadoPor: userId,
                atualizadoEm: new Date()
            },
        });

        return {
            ...user,
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm)
        };
    }
}