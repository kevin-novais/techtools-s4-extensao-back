import { Request, Response } from "express";
import { z } from "zod";
import { VendasBuildIntegrationJsonService } from "@/modules/vendas/services/VendasBuildIntegrationJsonService";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";

const vendasBuildIntegrationJsonParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasBuildIntegrationJsonController {
    async handle(req: Request, res: Response) {
        const { id } = vendasBuildIntegrationJsonParamsSchema.parse(req.params);
        const ciaIds = req.user?.ciaIds || [];

        await assertVendasHeaderCiaAccess(id, ciaIds);

        const buildService = new VendasBuildIntegrationJsonService();
        const result = await buildService.execute({
            vendasHeaderId: id,
        });

        return res.status(200).json(result);
    }
}
