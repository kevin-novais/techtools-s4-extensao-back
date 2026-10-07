import { Request, Response } from "express";
import { z } from "zod";
import { XtpgEnvioHeaderListService } from "@/modules/xtpg-envio/services/XtpgEnvioHeaderListService";

const paramsSchema = z.object({
    fluxo: z.enum(["previsto", "realizado"]).transform((v) => (v === "previsto" ? "PREVISTO" : "REALIZADO")),
});

const querySchema = z.object({
    status: z.string().trim().max(20).optional(),
    dataInicio: z.string().trim().optional(),
    dataFim: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export class XtpgEnvioHeaderListController {
    async handle(req: Request, res: Response) {
        const { fluxo } = paramsSchema.parse(req.params);
        const query = querySchema.parse(req.query);
        const result = await new XtpgEnvioHeaderListService().execute({ fluxo, ...query });
        return res.status(200).json(result);
    }
}
