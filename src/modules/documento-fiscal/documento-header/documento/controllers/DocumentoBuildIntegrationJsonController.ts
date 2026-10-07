import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoFiscalBuildIntegrationJsonService } from "../services/DocumentoFiscalBuildIntegrationJsonService";


const documentoFiscalBuildIntegrationJsonParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class DocumentoFiscalBuildIntegrationJsonController {
    async handle(req: Request, res: Response) {
        const usuarioId = req.user!.id;

        const { id } = documentoFiscalBuildIntegrationJsonParamsSchema.parse(req.params);

        const buildService = new DocumentoFiscalBuildIntegrationJsonService();
        const integracoesJson = await buildService.execute({
            documentoFiscalHeaderId: id,
            usuarioId,
        });

        return res.status(200).json(integracoesJson);
    }
}

