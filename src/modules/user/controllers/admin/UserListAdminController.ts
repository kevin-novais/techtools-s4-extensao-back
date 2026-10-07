import { Request, Response } from "express";
import { z } from "zod";
import { UserListService } from "@/modules/user/services/admin/UserListAdminService";
import { Perfil } from "@/@types/PermissionsTypes";

const PerfilEnum = z.enum([
    Perfil.ADMIN,
    Perfil.USER,
]);

const userListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    search: z.string().trim().optional(),
    perfil: PerfilEnum.optional(),
    ativo: z.enum(['true', 'false']).optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
});

export class UserListController {
    async handle(req: Request, res: Response) {
        const queryParams = userListQuerySchema.parse(req.query);

        const userListService = new UserListService();
        const result = await userListService.execute(queryParams);

        return res.status(200).json(result);
    }
}