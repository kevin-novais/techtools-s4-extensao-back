import { Request, Response } from "express";
import { z } from "zod";
import { ResetPasswordService } from "@/modules/auth/services/ResetPasswordService";


const tokenSchema = z.object({
    token: z.string({ message: "Token é obrigatório" })
        .min(1, { message: "Token não pode estar vazio" })
        .trim(),
});
const resetPasswordSchema = z.object({
    novaSenha: z.string({ message: "Nova senha é obrigatória" })
        .min(6, { message: "A senha deve ter no mínimo 6 caracteres" })
        .regex(/[a-zA-Z]/, { message: "A senha deve conter letras" })
        .regex(/[0-9]/, { message: "A senha deve conter números" }),
    confirmarSenha: z.string({ message: "Confirmação de senha é obrigatória" })
        .min(1, { message: "Confirmação de senha não pode estar vazia" }),
}).refine((data) => data.novaSenha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
});

export class ResetPasswordController {
    async handle(req: Request, res: Response) {
        const { novaSenha } = resetPasswordSchema.parse(req.body);
        const { token } = tokenSchema.parse(req.headers);

        const resetPasswordService = new ResetPasswordService();
        const result = await resetPasswordService.execute({ token, novaSenha });

        return res.status(200).json(result);
    }
}

