import crypto from "crypto";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { Config } from "@/config/config";
import { publishForgotPasswordEmail } from "@/queue/producers/emailProducer";
import { addMinutes } from "date-fns";

interface ForgotPasswordServiceProps {
    email: string;
}

export class ForgotPasswordService {
    async execute({ email }: ForgotPasswordServiceProps) {
        // Busca o usuário pelo email
        const user = await s4DotzClient.usuario.findUnique({
            where: { email },
            select: {
                id: true,
                nome: true,
                email: true,
                ativo: true,
            }
        });

        // Não expor se o usuário existe ou não (previne enumeração de emails)
        // Sempre retorna sucesso, mesmo se o email não existir
        if (!user) {
            return {
                message: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha."
            };
        }

        // Não envia email se o usuário estiver inativo
        if (!user.ativo) {
            return {
                message: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha."
            };
        }

        // Gera token único e criptografado
        const rawToken = crypto.randomBytes(32).toString('hex');
        
        // Calcula tempo de expiração
        const expirationDate = addMinutes(
            new Date(),
            Config.RESET_PASSWORD_TOKEN_EXPIRATION_MINUTES
        );

        // Salva o token no banco
        await s4DotzClient.tokenResetSenha.create({
            data: {
                usuarioId: user.id,
                token: rawToken,
                expiraEm: expirationDate,
            }
        });

        // Monta o link de reset
        const resetLink = `${Config.APP_URL}/reset-password?token=${rawToken}`;

        await publishForgotPasswordEmail({
            nome: user.nome,
            email: user.email,
            resetLink,
            expirationMinutes: Config.RESET_PASSWORD_TOKEN_EXPIRATION_MINUTES,
        });

        return {
            message: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha."
        };
    }
}

