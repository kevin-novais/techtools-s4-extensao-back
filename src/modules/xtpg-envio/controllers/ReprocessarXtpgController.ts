import { Request, Response } from "express";
import { z } from "zod";
import { ReprocessarXtpgService } from "@/modules/xtpg-envio/services/ReprocessarXtpgService";

const paramsSchema = z.object({
    fluxo: z.enum(["previsto", "realizado"]).transform((v) => (v === "previsto" ? "PREVISTO" : "REALIZADO")),
});

const bodySchema = z.object({
    detailIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
    modo: z.enum(["reenviar", "resetar"]),
});

export class ReprocessarXtpgController {
    async handle(req: Request, res: Response) {
        const { fluxo } = paramsSchema.parse(req.params);
        const { detailIds, modo } = bodySchema.parse(req.body ?? {});
        const result = await new ReprocessarXtpgService().execute({ fluxo, detailIds, modo });
        return res.status(200).json({ message: "Reprocessamento XTPG executado.", ...result });
    }
}
