import type { VendasDetalhe } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";

export function formatVendasDetalhe(detalhe: VendasDetalhe) {
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
