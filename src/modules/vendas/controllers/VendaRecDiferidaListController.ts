import { Request, Response } from "express";
import { z } from "zod";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { VendaRecDiferidaListService } from "@/modules/vendas/services/VendaRecDiferidaListService";

const statusSchema = z.enum([
    StatusVendaRecDiferida.PENDENTE,
    StatusVendaRecDiferida.INTEGRADO,
    StatusVendaRecDiferida.ERRO_INTEG,
    StatusVendaRecDiferida.REVERSAO_PENDENTE,
    StatusVendaRecDiferida.REVERTIDO,
    StatusVendaRecDiferida.ERRO_REVERT,
]);

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    status: statusSchema.optional(),
});

export class VendaRecDiferidaListController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId } = paramsSchema.parse(req.params);
        const query = querySchema.parse(req.query);

        const service = new VendaRecDiferidaListService();
        const result = await service.execute({
            vendasHeaderId,
            ciaIds,
            page: query.page,
            limit: query.limit,
            status: query.status,
        });

        return res.status(200).json(result);
    };
}
