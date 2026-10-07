import { Request, Response } from "express";
import { z } from "zod";
import {
    DocumentoDownloadService,
    TipoArquivoDownload,
} from "@/modules/documento-fiscal/documento-header/documento/services/DocumentoDownloadService";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
    tipo: z.nativeEnum(TipoArquivoDownload).default(TipoArquivoDownload.ROMANEIO),
});

const CONTENT_TYPES: Record<TipoArquivoDownload, string> = {
    [TipoArquivoDownload.ROMANEIO]: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    [TipoArquivoDownload.POS_PDF]: "application/pdf",
    [TipoArquivoDownload.POS_XLSX]: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export class DocumentoDownloadController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const { id } = paramsSchema.parse(req.params);
        const { tipo } = querySchema.parse(req.query);

        const service = new DocumentoDownloadService();
        const { stream, filename } = await service.execute(id, ciaIds, tipo);

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", CONTENT_TYPES[tipo]);

        stream.on("error", () => {
            if (!res.headersSent) res.status(500).json({ message: "Erro ao transmitir arquivo" });
        });

        stream.pipe(res);
    }
}
