// src/modules/integracoes/controllers/IntegracoesListController.ts
import { Request, Response } from "express";
import { IntegracoesListService } from "@/modules/integracoes/services/IntegracoesListService";

export class IntegracoesListController {
  async handle(_req: Request, res: Response) {
    const service = new IntegracoesListService();
    const integracoes = await service.execute();
    return res.json({ integracoes });
  }
}
