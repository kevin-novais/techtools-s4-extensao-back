import { Request, Response } from "express";
import { z } from "zod";
import { ValidateResetTokenService } from "@/modules/auth/services/ValidateResetTokenService";

const validateResetTokenSchema = z.object({
    token: z.string({ message: "Token é obrigatório" })
        .min(1, { message: "Token não pode estar vazio" })
        .trim(),
});

export class ValidateResetTokenController {
    async handle(req: Request, res: Response) {
        const { token } = validateResetTokenSchema.parse(req.query);

        const validateResetTokenService = new ValidateResetTokenService();
        const result = await validateResetTokenService.execute({ token });

        return res.status(200).json(result);
    }
}

