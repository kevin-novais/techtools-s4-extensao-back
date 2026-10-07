import { Request, Response } from "express";
import { z } from "zod";
import { DocumentoFiscalApproveService } from "../services/DocumentoFiscalApproveService";

const documentoFiscalApproveParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const documentoFiscalApproveBodySchema = z.object({
    observacao: z
        .string()
        .trim()
        .min(1, "Observação é obrigatória"),
});

export class DocumentoFiscalApproveController {
    async handle(req: Request, res: Response) {
        const usuarioId = req.user!.id;
        const ciaIds = req.user?.ciaIds || [];

        const { id } = documentoFiscalApproveParamsSchema.parse(req.params);
        const { observacao } = documentoFiscalApproveBodySchema.parse(req.body);

        const approveService = new DocumentoFiscalApproveService();
        const resultado = await approveService.execute({
            documentoId: id,
            usuarioId,
            ciaIds,
            observacao,
        });

        return res.status(resultado.statusGeral).json(resultado.integracoes);
    }
}
