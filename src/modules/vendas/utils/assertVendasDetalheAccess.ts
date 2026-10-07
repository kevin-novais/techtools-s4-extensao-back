import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";

interface AssertVendasDetalheAccessParams {
    vendasHeaderId: number;
    detalheId: number;
    ciaIds: number[];
    requireEditavel?: boolean;
}

export async function assertVendasDetalheAccess({
    vendasHeaderId,
    detalheId,
    ciaIds,
    requireEditavel,
}: AssertVendasDetalheAccessParams) {
    await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds, { requireEditavel });

    const detalhe = await s4DotzClient.vendasDetalhe.findUnique({
        where: { id: detalheId },
    });

    if (!detalhe) {
        throw new AppError("Detalhe da venda não encontrado", 404);
    }

    if (detalhe.vendasHeaderId !== vendasHeaderId) {
        throw new AppError("Detalhe não pertence à venda informada", 400);
    }

    return detalhe;
}
