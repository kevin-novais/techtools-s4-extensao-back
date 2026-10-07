import { Request, Response } from "express";
import { z } from "zod";
import { XtpgEnvioHeaderShowService } from "@/modules/xtpg-envio/services/XtpgEnvioHeaderShowService";

const paramsSchema = z.object({
    fluxo: z.enum(["previsto", "realizado"]).transform((v) => (v === "previsto" ? "PREVISTO" : "REALIZADO")),
    id: z.coerce.number().int().positive(),
});

export class XtpgEnvioHeaderShowController {
    async handle(req: Request, res: Response) {
        const { fluxo, id } = paramsSchema.parse(req.params);
        const result = await new XtpgEnvioHeaderShowService().execute({ fluxo, id });
        return res.status(200).json(result);
    }
}
