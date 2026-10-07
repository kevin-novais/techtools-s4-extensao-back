import type { Request, Response } from "express";
import { z } from "zod";
import { PublicFileDownloadService } from "@/modules/public-files/services/PublicFileDownloadService";

const filenameSchema = z.object({
    filename: z
        .string()
        .regex(/^[a-zA-Z0-9._-]{1,255}$/)
        .refine((value) => !value.includes(".."), "Nome de arquivo inválido"),
});

export class PublicFileDownloadController {
    async handle(req: Request, res: Response): Promise<void> {
        const { filename } = filenameSchema.parse(req.params);

        const service = new PublicFileDownloadService();
        const { stream, mimeType } = await service.execute(filename);

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        stream.pipe(res);
    }
}
