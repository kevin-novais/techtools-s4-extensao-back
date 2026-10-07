import s4DotzClient from "@/database/clients/s4DotzClient";
import bcrypt from "bcrypt";
import AppError from "@/util/AppError";
import { generatePassword } from "@/util/security/generatePassword";
import { Config } from "@/config/config";
import { sendWelcomeEmail } from "@/util/emails/welcomeEmail";

interface UserResendWelcomeEmailAdminServiceProps {
    userId: number;
}

export class UserResendWelcomeEmailAdminService {
    async execute({ userId }: UserResendWelcomeEmailAdminServiceProps) {
        const user = await s4DotzClient.usuario.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError("Usuário não encontrado", 404);
        }

        if (!user.ativo) {
            throw new AppError("Usuário está inativo — reative antes de reenviar o e-mail", 400);
        }

        // A senha original não fica salva em texto puro em lugar nenhum (só o hash) — reenviar
        // o e-mail de boas-vindas exige gerar uma senha temporária nova. Envia primeiro e só
        // sobrescreve a senha do usuário se o e-mail sair com sucesso, pra não invalidar a senha
        // atual caso o envio falhe (ficaria sem acesso a nenhuma senha válida).
        const senhaGerada = generatePassword();

        try {
            await sendWelcomeEmail({
                nome: user.nome,
                email: user.email,
                senha: senhaGerada,
                appUrl: Config.APP_URL,
            });
        } catch (error) {
            const mensagem = error instanceof Error ? error.message : "Erro desconhecido";
            throw new AppError(`Erro ao enviar e-mail de boas-vindas: ${mensagem}`, 502);
        }

        const senhaHash = await bcrypt.hash(senhaGerada, 10);
        await s4DotzClient.usuario.update({
            where: { id: userId },
            data: {
                senha: senhaHash,
                atualizadoPor: userId,
                atualizadoEm: new Date(),
            },
        });

        return { message: "E-mail de boas-vindas reenviado com sucesso" };
    }
}
