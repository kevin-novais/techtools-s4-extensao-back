import { Request, Response } from "express";
import { z } from "zod";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { publishReverterDiferida } from "@/queue/producers/vendaRecDiferidaProducer";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
    difeididaId: z.coerce.number().int().positive(),
});

export class VendaRecDiferidaReverterController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId, difeididaId } = paramsSchema.parse(req.params);

        const parcela = await s4DotzClient.vendaRecDiferida.findUnique({
            where: { id: difeididaId },
            select: {
                id: true,
                status: true,
                vendasHeaderId: true,
            },
        });

        if (!parcela || parcela.vendasHeaderId !== vendasHeaderId) {
            throw new AppError("Parcela diferida não encontrada", 404);
        }

        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        const statusesRevertiveis = new Set<StatusVendaRecDiferida>([
            StatusVendaRecDiferida.INTEGRADO,
            StatusVendaRecDiferida.ERRO_REVERT,
        ]);

        if (!statusesRevertiveis.has(parcela.status as StatusVendaRecDiferida)) {
            throw new AppError(
                `Parcela não pode ser revertida no status atual: ${parcela.status}`,
                400,
            );
        }

        await s4DotzClient.vendaRecDiferida.update({
            where: { id: difeididaId },
            data: { status: StatusVendaRecDiferida.REVERSAO_PENDENTE },
        });

        await publishReverterDiferida({ vendaRecDiferidaId: difeididaId });

        return res.status(200).json({
            message: "Parcela marcada para reversão e enfileirada",
            vendaRecDiferidaId: difeididaId,
        });
    };
}
