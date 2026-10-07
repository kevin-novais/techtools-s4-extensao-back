import { Request, Response } from "express";
import { z } from "zod";
import { RomaneioDeleteService } from "@/modules/documento-fiscal/documento-header/romaneio/services/RomaneioDeleteService";

const romaneioDeleteIdSchema = z.object({
    id: z.string(),
});

export class RomaneioDeleteController {
    async handle(req: Request, res: Response) {
        const romaneioId = romaneioDeleteIdSchema.parse(req.params).id;

        const romaneioDeleteService = new RomaneioDeleteService();
        const result = await romaneioDeleteService.execute(Number(romaneioId));

        return res.status(200).json(result);
    }
}

