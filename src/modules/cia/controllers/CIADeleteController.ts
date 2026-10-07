import { Request, Response } from "express";
import { z } from "zod";
import { CIADeleteService } from "@/modules/cia/services/CIADeleteService";

const ciaDeleteIdSchema = z.object({
    id: z.string(),
});

export class CIADeleteController {
    async handle(req: Request, res: Response) {
        const ciaId = ciaDeleteIdSchema.parse(req.params).id;
        const atualizadoPor = req.user?.id!;

        const ciaDeleteService = new CIADeleteService();
        const result = await ciaDeleteService.execute(Number(ciaId), atualizadoPor);

        return res.status(200).json(result);
    }
}

