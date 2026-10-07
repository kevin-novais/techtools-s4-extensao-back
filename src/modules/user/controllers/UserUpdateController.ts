import { Request, Response } from "express";
import { UserUpdateService } from "@/modules/user/services/UserUpdateService";
import { z } from "zod";

const userUpdateSchema = z.object({
    email: z.string().email({ message: "Email inválido" }).optional(),
    senhaAtual: z.string().optional(),
    senhaNova: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }).optional(),
    confirmarSenhaNova: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }).optional(),
    nome: z.string().optional(),
}).refine((data) => {
    if (data.senhaNova === undefined && data.confirmarSenhaNova === undefined) {
        return true;
    }
    return data.senhaNova === data.confirmarSenhaNova;
}, {
    message: "As senhas não coincidem",
    path: ["confirmarSenhaNova"],
}).refine((data) => {
    if (data.senhaNova === undefined || data.senhaAtual === undefined) {
        return true;
    }
    return data.senhaNova !== data.senhaAtual;
}, {
    message: "A senha nova não pode ser igual à senha atual",
    path: ["senhaNova"],
});

export class UserUpdateController {
    async handle(req: Request, res: Response) {
        const { email, senhaAtual, senhaNova, nome } = userUpdateSchema.parse(req.body);
        const userId = req.user?.id!;

        const userUpdateService = new UserUpdateService();
        await userUpdateService.execute(userId, { email, senhaAtual, senhaNova, nome });

        return res.status(200).json();
    }
}