import { Request, Response } from "express";
import { z } from "zod";
import { AuthSessionService } from "@/modules/auth/services/AuthSessionService";


const authSessionSchema = z.object({
    email: z.string({ message: "Email é obrigatório" }).email({ message: "Email inválido" }),
    password: z.string({ message: "Senha é obrigatória" }),
});

export class AuthSessionController {
    async handle(req: Request, res: Response) {
        const { email, password } = authSessionSchema.parse(req.body)

        const authSessionService = new AuthSessionService();
        const accessToken = await authSessionService.execute({ email, password });

        return res.status(200).json({ accessToken });

    }
}