import { validateResetToken } from "@/modules/auth/utils/validateResetToken";

interface ValidateResetTokenServiceProps {
    token: string;
}

export class ValidateResetTokenService {
    async execute({ token }: ValidateResetTokenServiceProps) {
        // Valida o token
        await validateResetToken(token);

        return {
            valid: true,
            message: "Token válido"
        };
    }
}

