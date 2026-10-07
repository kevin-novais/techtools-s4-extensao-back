import { Request, Response } from "express";
import { z } from "zod";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { publishIntegrarVendas } from "@/queue/producers/vendasIntegrationProducer";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const STATUSES_REPROCESSAVEIS = new Set<StatusVendas>([
    StatusVendas.PENDENTE,
    StatusVendas.PROCESSANDO,
    StatusVendas.ERRO_PROC,
    StatusVendas.ERRO_INTEG_SAP,
]);

export class VendasReprocessarController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId } = paramsSchema.parse(req.params);

        const { header } = await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        if (!STATUSES_REPROCESSAVEIS.has(header.status as StatusVendas)) {
            throw new AppError(
                `Venda não pode ser reprocessada no status atual: ${header.status}`,
                400,
            );
        }

        const previousStatus = header.status;

        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                status: StatusVendas.PROCESSANDO,
                atualizadoEm: new Date(),
            },
        });

        try {
            await publishIntegrarVendas({ vendasHeaderId });
        } catch (error) {
            await s4DotzClient.vendasHeader.update({
                where: { id: vendasHeaderId },
                data: {
                    status: previousStatus,
                    atualizadoEm: new Date(),
                },
            });
            throw error;
        }

        return res.status(200).json({
            message: "Venda enfileirada para reprocessamento",
            vendasHeaderId,
        });
    };
}
