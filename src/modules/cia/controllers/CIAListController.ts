import { Request, Response } from "express";
import { z } from "zod";
import { CIAListService } from "@/modules/cia/services/CIAListService";

const ciaListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    search: z.string().trim().optional(),
    includeDeleted: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true' ? true : false),
});

export class CIAListController {
    async handle(req: Request, res: Response) {
        const queryParams = ciaListQuerySchema.parse(req.query);

        const ciaListService = new CIAListService();
        const result = await ciaListService.execute(queryParams);

        return res.status(200).json(result);
    }
}

