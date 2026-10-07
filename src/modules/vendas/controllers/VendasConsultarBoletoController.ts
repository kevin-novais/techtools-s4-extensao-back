import { Request, Response } from "express";
import { z } from "zod";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { VendasConsultarBoletoService } from "@/modules/vendas/services/VendasConsultarBoletoService";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class VendasConsultarBoletoController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId } = paramsSchema.parse(req.params);

        const { header } = await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        const resultado = await new VendasConsultarBoletoService().execute({
            vendasHeaderId,
            status: header.status,
        });

        return res.status(200).json({
            message: "Boleto obtido com sucesso",
            ...resultado,
        });
    };
}
