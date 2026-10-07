import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoShowService } from "@/modules/documento-fiscal/documento-header/documento/services/DocumentoShowService";


const romaneioShowParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class DocumentoShowController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id } = romaneioShowParamsSchema.parse(req.params);

        const showService = new DocumentoShowService();
        const documento = await showService.execute(id, ciaIds);

        return res.status(200).json(documento);
    }
}

