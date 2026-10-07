import { Request, Response } from "express";
import { z } from "zod";
import { VendasDownloadArquivoService } from "@/modules/vendas/services/VendasDownloadArquivoService";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
    tipo: z.enum([
        "relatorio-pdf",
        "relatorio-xlsx",
        "boleto",
        "fatura-detalhada",
        "relatorio-analitico",
    ]),
});

export class VendasDownloadArquivoController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id, tipo } = paramsSchema.parse(req.params);

        const service = new VendasDownloadArquivoService();
        const { stream, filename, contentType } = await service.execute({
            vendasHeaderId: id,
            ciaIds,
            tipo,
        });

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", contentType);

        stream.on("error", () => {
            if (!res.headersSent) res.status(500).json({ message: "Erro ao transmitir arquivo" });
        });

        stream.pipe(res);
    };
}
