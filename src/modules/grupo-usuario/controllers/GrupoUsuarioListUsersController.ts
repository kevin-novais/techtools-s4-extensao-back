import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioListUsersService } from "@/modules/grupo-usuario/services/GrupoUsuarioListUsersService";

const grupoUsuarioListUsersParamsSchema = z.object({
    id: z.string(),
});

const grupoUsuarioListUsersQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    search: z.string().trim().optional(),
});

export class GrupoUsuarioListUsersController {
    async handle(req: Request, res: Response) {
        const { id } = grupoUsuarioListUsersParamsSchema.parse(req.params);
        const queryParams = grupoUsuarioListUsersQuerySchema.parse(req.query);

        const grupoUsuarioListUsersService = new GrupoUsuarioListUsersService();
        const result = await grupoUsuarioListUsersService.execute({
            grupoUsuarioId: Number(id),
            ...queryParams,
        });

        return res.status(200).json(result);
    }
}

