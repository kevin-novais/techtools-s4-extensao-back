import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { formatDateToBrazilianTimezone } from "@/util/date";

interface VendasDetalheShowResponse {
    id: number;
    vendasHeaderId: number;
    itemDocumento: number | null;
    codigoProdutoDotz: string | null;
    descricaoProduto: string | null;
    centroLucro: string | null;
    centroCusto: string | null;
    quantidadePontos: number | null;
    valorVenda: string | null;
    precoUnitario: string | null;
    custoPontos: string | null;
    criadoEm: string;
    atualizadoEm: string;
}

export class VendasDetalheShowService {
    async execute(detalheId: number, ciaIds: number[]): Promise<VendasDetalheShowResponse> {
        const detalhe = await s4DotzClient.vendasDetalhe.findUnique({
            where: { id: detalheId },
        });

        if (!detalhe) {
            throw new AppError("Detalhe da venda não encontrado", 404);
        }

        await assertVendasHeaderCiaAccess(detalhe.vendasHeaderId, ciaIds);

        return {
            id: detalhe.id,
            vendasHeaderId: detalhe.vendasHeaderId,
            itemDocumento: detalhe.itemDocumento,
            codigoProdutoDotz: detalhe.codigoProdutoDotz,
            descricaoProduto: detalhe.descricaoProduto,
            centroLucro: detalhe.centroLucro,
            centroCusto: detalhe.centroCusto,
            quantidadePontos: detalhe.quantidadePontos,
            valorVenda: detalhe.valorVenda ? detalhe.valorVenda.toString() : null,
            precoUnitario: detalhe.precoUnitario ? detalhe.precoUnitario.toString() : null,
            custoPontos: detalhe.custoPontos ? detalhe.custoPontos.toString() : null,
            criadoEm: formatDateToBrazilianTimezone(detalhe.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(detalhe.atualizadoEm),
        };
    }
}
