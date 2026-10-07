import bcrypt from "bcrypt";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { validateResetToken } from "@/modules/auth/utils/validateResetToken";

interface ResetPasswordServiceProps {
    token: string;
    novaSenha: string;
}

export class ResetPasswordService {
    async execute({ token, novaSenha }: ResetPasswordServiceProps) {
        // Valida o token e obtém o registro
        const tokenRecord = await validateResetToken(token);

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(novaSenha, 10);

        // Atualiza a senha do usuário e marca o token como usado (transação)
        await s4DotzClient.$transaction([
            s4DotzClient.usuario.update({
                where: { id: tokenRecord.usuarioId },
                data: { 
                    senha: hashedPassword,
                    atualizadoEm: new Date(),
                    atualizadoPor: tokenRecord.usuarioId, // Usuário atualizou sua própria senha
                }
            }),
            s4DotzClient.tokenResetSenha.update({
                where: { id: tokenRecord.id },
                data: { usado: true }
            })
        ]);

        return {
            message: "Senha redefinida com sucesso"
        };
    }
}

