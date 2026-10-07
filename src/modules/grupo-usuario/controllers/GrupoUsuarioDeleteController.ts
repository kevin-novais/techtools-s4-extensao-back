import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioDeleteService } from "@/modules/grupo-usuario/services/GrupoUsuarioDeleteService";

const grupoUsuarioDeleteIdSchema = z.object({
    id: z.string(),
});

export class GrupoUsuarioDeleteController {
    async handle(req: Request, res: Response) {
        const grupoUsuarioId = grupoUsuarioDeleteIdSchema.parse(req.params).id;
        const atualizadoPor = req.user?.id!;

        const grupoUsuarioDeleteService = new GrupoUsuarioDeleteService();
        const result = await grupoUsuarioDeleteService.execute(Number(grupoUsuarioId), atualizadoPor);

        return res.status(200).json(result);
    }
}

