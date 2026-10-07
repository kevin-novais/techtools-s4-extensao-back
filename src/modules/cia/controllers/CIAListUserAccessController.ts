import { Request, Response } from "express";
import { CIAListUserAccessService } from "@/modules/cia/services/CIAListUserAccessService";

export class CIAListUserAccessController {
    async handle(req: Request, res: Response) {
        const usuarioId = req.user?.id!;

        const ciaListUserAccessService = new CIAListUserAccessService();
        const result = await ciaListUserAccessService.execute(usuarioId);

        return res.status(200).json(result);
    }
}

