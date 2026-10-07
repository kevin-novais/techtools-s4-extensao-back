import { Request, Response } from "express";
import { z } from "zod";
import AppError from "@/util/AppError";
import { PosReprocessarService } from "@/modules/documento-fiscal/documento-header/pos/services/PosReprocessarService";

const posReprocessarSchema = z.object({
    id: z.string().transform((val) => {
        const num = Number(val);
        if (Number.isNaN(num)) throw new AppError("ID do documento deve ser um número válido", 400);
        return num;
    }),
});

export class PosReprocessarController {
    async handle(req: Request, res: Response) {
        const { id } = posReprocessarSchema.parse(req.params);
        const usuarioId = req.user!.id;

        const service = new PosReprocessarService();
        const documento = await service.execute({ documentoId: id, usuarioId });

        return res.status(200).json({
            message: "Documento POS enviado para reprocessamento com sucesso",
            documento,
        });
    }
}
