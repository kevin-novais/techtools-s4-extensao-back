import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { isVendaHeaderEditavel } from "@/modules/vendas/utils/vendasStatusEditable";
import { VENDAS_HEADER_ACCESS_SELECT } from "@/modules/vendas/utils/vendasHeaderSelect";

interface VendasHeaderAccessRow {
    id: number;
    ciaIdSAP: string;
    status: string;
}

export interface VendasHeaderCiaAccessResult {
    header: VendasHeaderAccessRow;
    cia: { id: number };
}

export async function assertVendasHeaderCiaAccess(
    vendasHeaderId: number,
    ciaIds: number[],
    options?: { requireEditavel?: boolean },
): Promise<VendasHeaderCiaAccessResult> {
    if (ciaIds.length === 0) {
        throw new AppError("Você não tem acesso a nenhuma CIA", 403);
    }

    const header = await s4DotzClient.vendasHeader.findUnique({
        where: { id: vendasHeaderId },
        select: VENDAS_HEADER_ACCESS_SELECT,
    });

    if (!header) {
        throw new AppError("Venda não encontrada", 404);
    }

    const cia = await s4DotzClient.cia.findFirst({
        where: {
            ciaIdSAP: header.ciaIdSAP,
            deletadoEm: null,
        },
        select: { id: true },
    });

    if (!cia || !ciaIds.includes(cia.id)) {
        throw new AppError("Você não tem acesso a esta CIA", 403);
    }

    if (options?.requireEditavel && !isVendaHeaderEditavel(header.status)) {
        throw new AppError(
            "Venda não pode ser alterada manualmente no status atual",
            400,
        );
    }

    return { header, cia };
}

export async function assertCiaIdUsuarioAccess(
    ciaId: number,
    ciaIds: number[],
): Promise<{ id: number; ciaIdSAP: string }> {
    if (ciaIds.length === 0) {
        throw new AppError("Você não tem acesso a nenhuma CIA", 403);
    }

    const cia = await s4DotzClient.cia.findFirst({
        where: {
            id: ciaId,
            deletadoEm: null,
        },
        select: {
            id: true,
            ciaIdSAP: true,
        },
    });

    if (!cia) {
        throw new AppError("CIA não encontrada", 404);
    }

    if (!ciaIds.includes(cia.id)) {
        throw new AppError("Você não tem acesso a esta CIA", 403);
    }

    const ciaIdSAP = cia.ciaIdSAP?.trim();
    if (!ciaIdSAP) {
        throw new AppError("CIA não possui código SAP (ciaIdSAP) configurado", 400);
    }

    return { id: cia.id, ciaIdSAP };
}
