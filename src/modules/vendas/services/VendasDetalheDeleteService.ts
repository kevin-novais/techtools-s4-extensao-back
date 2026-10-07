import s4DotzClient from "@/database/clients/s4DotzClient";
import { assertVendasDetalheAccess } from "@/modules/vendas/utils/assertVendasDetalheAccess";

interface VendasDetalheDeleteServiceParams {
    vendasHeaderId: number;
    detalheId: number;
    ciaIds: number[];
}

export class VendasDetalheDeleteService {
    async execute({ vendasHeaderId, detalheId, ciaIds }: VendasDetalheDeleteServiceParams) {
        await assertVendasDetalheAccess({
            vendasHeaderId,
            detalheId,
            ciaIds,
            requireEditavel: true,
        });

        await s4DotzClient.vendasDetalhe.delete({
            where: { id: detalheId },
        });

        return {
            message: "Detalhe da venda removido com sucesso",
        };
    }
}
