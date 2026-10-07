import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface TokenRecord {
    id: number;
    usuarioId: number;
    expiraEm: Date;
    usado: boolean;
}

export async function validateResetToken(token: string): Promise<TokenRecord> {
    // Busca o token no banco
    const tokenRecord = await s4DotzClient.tokenResetSenha.findUnique({
        where: { token },
        select: {
            id: true,
            usuarioId: true,
            expiraEm: true,
            usado: true,
        }
    });

    // Token não encontrado
    if (!tokenRecord) {
        throw new AppError("Token inválido ou expirado", 400);
    }

    // Token já foi usado
    if (tokenRecord.usado) {
        throw new AppError("Token inválido ou expirado", 400);
    }

    // Token expirado
    const now = new Date();
    if (now > tokenRecord.expiraEm) {
        throw new AppError("Este link expirou. Solicite um novo link de recuperação", 400);
    }

    return tokenRecord;
}

