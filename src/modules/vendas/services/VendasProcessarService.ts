import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { VendasShowService } from "@/modules/vendas/services/VendasShowService";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import AppError from "@/util/AppError";

interface VendasProcessarServiceParams {
    id: number;
    ciaIds: number[];
}

export class VendasProcessarService {
    async execute({ id, ciaIds }: VendasProcessarServiceParams) {
        const { header } = await assertVendasHeaderCiaAccess(id, ciaIds);

        if (header.status !== StatusVendas.CADASTRO) {
            throw new AppError(
                "Somente vendas com status CADASTRO podem ser processadas",
                400,
            );
        }

        const result = await s4DotzClient.vendasHeader.updateMany({
            where: {
                id,
                status: StatusVendas.CADASTRO,
            },
            data: {
                status: StatusVendas.PENDENTE,
                atualizadoEm: new Date(),
            },
        });

        if (result.count === 0) {
            throw new AppError("A venda já foi processada", 409);
        }

        return new VendasShowService().execute(id, ciaIds);
    }
}
