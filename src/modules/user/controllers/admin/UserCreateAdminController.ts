import { Request, Response } from "express";
import { z } from "zod";
import { UserCreateAdminService } from "@/modules/user/services/admin/UserCreateAdminService";
import { Perfil } from "@/@types/PermissionsTypes";

const PerfilEnum = z.enum([
    Perfil.ADMIN,
    Perfil.USER,
]);

const userCreateAdminSchema = z.object({
    email: z.string({ message: "Email é obrigatório" }).email({ message: "Email inválido" }),
    nome: z.string({ message: "Nome é obrigatório" }),
    perfil: PerfilEnum.optional(),
});

export class UserCreateAdminController {
    async handle(req: Request, res: Response) {
        const { email, nome, perfil } = userCreateAdminSchema.parse(req.body);

        const atualizadoPor = req.user?.id!;

        const userCreateAdminService = new UserCreateAdminService();

        const user = await userCreateAdminService.execute({ email, nome, perfil, atualizadoPor });


        return res.status(200).json({
            message: "Usuário criado com sucesso",
            user,
        });
    }
}