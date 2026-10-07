import s4DotzClient from "@/database/clients/s4DotzClient";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { assertVendasHeaderPodeSerExcluido } from "@/modules/vendas/utils/assertVendasHeaderPodeSerExcluido";

interface VendasDeleteServiceParams {
    id: number;
    ciaIds: number[];
}

export class VendasDeleteService {
    async execute({ id, ciaIds }: VendasDeleteServiceParams) {
        await assertVendasHeaderCiaAccess(id, ciaIds, { requireEditavel: true });
        await assertVendasHeaderPodeSerExcluido(id);

        await s4DotzClient.vendasHeader.delete({
            where: { id },
        });

        return {
            message: "Venda removida com sucesso",
        };
    }
}
