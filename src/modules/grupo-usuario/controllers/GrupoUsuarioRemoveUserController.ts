import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioRemoveUserService } from "@/modules/grupo-usuario/services/GrupoUsuarioRemoveUserService";

const grupoUsuarioRemoveUserSchema = z.object({
    id: z.string(),
    usuarioId: z.string(),
});

export class GrupoUsuarioRemoveUserController {
    async handle(req: Request, res: Response) {
        const { id, usuarioId } = grupoUsuarioRemoveUserSchema.parse(req.params);

        const grupoUsuarioRemoveUserService = new GrupoUsuarioRemoveUserService();
        const result = await grupoUsuarioRemoveUserService.execute(Number(id), Number(usuarioId));

        return res.status(200).json(result);
    }
}

