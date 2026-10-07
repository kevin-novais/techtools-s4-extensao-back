import { Request, Response } from "express";
import { z } from "zod";
import { ForgotPasswordService } from "@/modules/auth/services/ForgotPasswordService";

const forgotPasswordSchema = z.object({
    email: z.string({ message: "Email é obrigatório" })
        .email({ message: "Email inválido" })
        .toLowerCase()
        .trim(),
});

export class ForgotPasswordController {
    async handle(req: Request, res: Response) {
        const { email } = forgotPasswordSchema.parse(req.body);

        const forgotPasswordService = new ForgotPasswordService();
        const result = await forgotPasswordService.execute({ email });

        return res.status(200).json(result);
    }
}

