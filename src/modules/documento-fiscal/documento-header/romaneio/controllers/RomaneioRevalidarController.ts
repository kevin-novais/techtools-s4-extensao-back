import { Request, Response } from "express";
import { z } from "zod";
import AppError from "@/util/AppError";
import { RomaneioRevalidarService } from "@/modules/documento-fiscal/documento-header/romaneio/services/RomaneioRevalidarService";

const romaneioRevalidarSchema = z.object({
    id: z.string().transform((val) => {
        const num = Number(val);
        if (Number.isNaN(num)) {
            throw new AppError("ID do documento deve ser um número válido", 400);
        }
        return num;
    }),
});

export class RomaneioRevalidarController {
    async handle(req: Request, res: Response) {
        const { id } = romaneioRevalidarSchema.parse(req.params);
        const usuarioId = req.user?.id!;
        const filename = req.file?.filename;

        const romaneioRevalidarService = new RomaneioRevalidarService();
        const documento = await romaneioRevalidarService.execute({
            documentoId: id,
            ...(filename ? { filename } : {}),
            usuarioId,
        });

        return res.status(200).json({
            message: "Documento revalidado com sucesso",
            documento,
        });
    }
}
