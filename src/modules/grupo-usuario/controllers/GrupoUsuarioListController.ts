import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioListService } from "@/modules/grupo-usuario/services/GrupoUsuarioListService";

const grupoUsuarioListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    search: z.string().trim().optional(),
    grupoId: z.coerce.number().int().positive().optional(),
    aprovaDivergencia: z.enum(['true', 'false']).optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    includeDeleted: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true' ? true : false),
});

export class GrupoUsuarioListController {
    async handle(req: Request, res: Response) {
        const queryParams = grupoUsuarioListQuerySchema.parse(req.query);

        const grupoUsuarioListService = new GrupoUsuarioListService();
        const result = await grupoUsuarioListService.execute(queryParams);

        return res.status(200).json(result);
    }
}

