import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoRelatorioService } from "@/modules/documento-fiscal/documento-header/documento/services/DocumentoRelatorioService";

const documentoRelatorioParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class DocumentoRelatorioController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id } = documentoRelatorioParamsSchema.parse(req.params);

        const documentoRelatorioService = new DocumentoRelatorioService();
        const resultado = await documentoRelatorioService.execute({
            documentoFiscalHeaderId: id,
            ciaIds,
        });

        return res.status(200).json({
            message: "Relatório gerado com sucesso",
            ...resultado,
        });
    }
}
