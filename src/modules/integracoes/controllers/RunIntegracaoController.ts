// src/modules/integracoes/controllers/RunIntegracaoController.ts
import { Request, Response } from "express";
import { z } from "zod";
import { cronManager } from "@/cron";

const paramsSchema = z.object({ key: z.string().min(1) });

export class RunIntegracaoController {
  async handle(req: Request, res: Response) {
    const { key } = paramsSchema.parse(req.params);
    const triggeredBy = (req as Request & { user?: { email?: string } }).user?.email ?? null;

    const result = await cronManager.triggerJob(key, { triggeredBy });

    if (!result.started) {
      if (result.reason === "unknown") {
        return res.status(404).json({ message: "Integração não encontrada" });
      }
      if (result.reason === "not_manual") {
        return res.status(403).json({ message: "Integração não permite execução manual" });
      }
      return res.status(409).json({ message: "Integração já está em execução" });
    }

    return res.status(202).json({ message: "Execução iniciada", logId: result.logId });
  }
}
