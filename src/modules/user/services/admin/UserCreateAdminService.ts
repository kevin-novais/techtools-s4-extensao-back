import s4DotzClient from "@/database/clients/s4DotzClient";
import bcrypt from "bcrypt";
import AppError from "@/util/AppError";
import { Perfil } from "@/@types/PermissionsTypes";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { generatePassword } from "@/util/security/generatePassword";
import { Config } from "@/config/config";
import { publishWelcomeEmail } from "@/queue/producers/emailProducer";


interface UserCreateAdminServiceProps {
    email: string;
    nome: string;
    atualizadoPor: number;
    perfil?: Perfil;
}

export class UserCreateAdminService {
    async execute({ email, nome, atualizadoPor, perfil }: UserCreateAdminServiceProps) {
    

        const userExist = await s4DotzClient.usuario.findUnique({
            where: {
                email
            }
        });

        if (userExist) {
            throw new AppError("Email já cadastrado", 400);
        }

        // Gera a senha
        const senhaGerada = generatePassword();
        const hashed = await bcrypt.hash(senhaGerada, 10);


        const user = await s4DotzClient.usuario.create({
            data: { 
                email, 
                senha: hashed, 
                nome, 
                perfil,
                atualizadoPor, 
                atualizadoEm: new Date(),
            }
        });

        const formattedUser = {
            id: user.id,
            email: user.email,
            nome: user.nome,
            ativo: user.ativo,
            atualizadoPor: user.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm)
        }

        await publishWelcomeEmail({
            nome: user.nome,
            email: user.email,
            senha: senhaGerada,
            appUrl: Config.APP_URL,
        });

        return formattedUser;
    }
}