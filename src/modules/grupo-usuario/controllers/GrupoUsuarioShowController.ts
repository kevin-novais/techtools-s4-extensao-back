import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioShowService } from "@/modules/grupo-usuario/services/GrupoUsuarioShowService";

const grupoUsuarioShowIdSchema = z.object({
    id: z.string(),
});

export class GrupoUsuarioShowController {
    async handle(req: Request, res: Response) {
        const grupoUsuarioId = grupoUsuarioShowIdSchema.parse(req.params).id;

        const grupoUsuarioShowService = new GrupoUsuarioShowService();
        const grupoUsuario = await grupoUsuarioShowService.execute(Number(grupoUsuarioId));

        return res.status(200).json({
            grupoUsuario,
        });
    }
}

