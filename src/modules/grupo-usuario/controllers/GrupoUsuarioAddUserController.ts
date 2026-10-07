import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioAddUserService } from "@/modules/grupo-usuario/services/GrupoUsuarioAddUserService";

const grupoUsuarioAddUserSchema = z.object({
    id: z.string(),
    usuarioId: z.string(),
});

export class GrupoUsuarioAddUserController {
    async handle(req: Request, res: Response) {
        const { id, usuarioId } = grupoUsuarioAddUserSchema.parse(req.params);
        const atualizadoPor = req.user?.id!;

        const grupoUsuarioAddUserService = new GrupoUsuarioAddUserService();
        const result = await grupoUsuarioAddUserService.execute(Number(id), Number(usuarioId), atualizadoPor);

        return res.status(201).json(result);
    }
}

