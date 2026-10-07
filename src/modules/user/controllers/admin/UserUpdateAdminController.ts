import { Request, Response } from "express";
import { UserUpdateAdminService } from "@/modules/user/services/admin/UserUpdateAdminService";
import { z } from "zod";
import { Perfil } from "@/@types/PermissionsTypes";


const PerfilEnum = z.enum([
    Perfil.ADMIN,
    Perfil.USER,
]);

const userUpdateAdminIdSchema = z.object({
    id: z.string()
});

const userUpdateAdminSchema = z.object({
    nome: z.string().optional(),
    ativo: z.boolean().optional(),
    perfil: PerfilEnum.optional(),
});

export class UserUpdateAdminController {
    async handle(req: Request, res: Response) {
        const { nome, ativo, perfil } = userUpdateAdminSchema.parse(req.body);
        const userId = userUpdateAdminIdSchema.parse(req.params).id;

        const userUpdateAdminService = new UserUpdateAdminService();
        await userUpdateAdminService.execute(Number(userId), { nome, ativo, perfil });

        return res.status(200).json({
            message: "Usuário atualizado com sucesso",
        });
    }
}