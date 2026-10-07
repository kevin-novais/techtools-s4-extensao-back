import { Request, Response } from "express";
import { z } from "zod";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const STATUSES_REENVIAVEIS = new Set<StatusVendas>([
    StatusVendas.ERRO_EMAIL,
    StatusVendas.CONCLUIDO,
]);

export class VendasReenviarEmailController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId } = paramsSchema.parse(req.params);

        const { header } = await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        if (!STATUSES_REENVIAVEIS.has(header.status as StatusVendas)) {
            throw new AppError(
                `E-mail não pode ser reenviado no status atual: ${header.status}`,
                400,
            );
        }

        // O cron process_vendas_enviar_email já busca periodicamente vendas em ENVIANDO_EMAIL
        // e dispara o envio — não é necessário publicar em fila aqui, só marcar pra reenvio.
        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                status: StatusVendas.ENVIANDO_EMAIL,
                atualizadoEm: new Date(),
            },
        });

        return res.status(200).json({
            message: "E-mail encaminhado para reenvio",
            vendasHeaderId,
        });
    };
}
