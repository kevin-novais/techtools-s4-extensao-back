import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";

const STATUS_DIFERIDA_PERMITE_DELETE_HEADER = new Set<string>([
    StatusVendaRecDiferida.PENDENTE,
    StatusVendaRecDiferida.ERRO_INTEG,
]);

export async function assertVendasHeaderPodeSerExcluido(vendasHeaderId: number): Promise<void> {
    const diferidaBloqueante = await s4DotzClient.vendaRecDiferida.findFirst({
        where: {
            vendasHeaderId,
            status: {
                notIn: [...STATUS_DIFERIDA_PERMITE_DELETE_HEADER],
            },
        },
        select: { id: true, status: true },
    });

    if (diferidaBloqueante) {
        throw new AppError(
            "Venda não pode ser excluída pois possui receita diferida em processamento ou integrada",
            400,
        );
    }
}
