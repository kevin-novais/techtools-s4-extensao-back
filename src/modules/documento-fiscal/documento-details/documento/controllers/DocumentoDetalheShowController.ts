import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoDetalheShowService, } from "@/modules/documento-fiscal/documento-details/documento/services/DocumentoDetalheShowService";

const documentoDetalheShowParamsSchema = z.object({
    headerId: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

export class DocumentoDetalheShowController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { detalheId } = documentoDetalheShowParamsSchema.parse(req.params);

        const documentoDetalheShowService = new DocumentoDetalheShowService();
        const detalhe = await documentoDetalheShowService.execute(detalheId, ciaIds);

        return res.status(200).json(detalhe);
    }
}

