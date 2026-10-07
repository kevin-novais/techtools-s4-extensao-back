import s4DotzClient from "@/database/clients/s4DotzClient";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";

interface VendasDetalheListParams {
    ciaIds: number[];
    vendasHeaderId: number;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    itemDocumento?: number;
    codigoProdutoDotz?: string;
}

interface VendasDetalheListResponse {
    detalhes: Array<{
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
    }>;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class VendasDetalheListService {
    async execute(params: VendasDetalheListParams): Promise<VendasDetalheListResponse> {
        const {
            ciaIds,
            vendasHeaderId,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            itemDocumento,
            codigoProdutoDotz,
        } = params;

        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        const codigoProdutoDotzFiltro = codigoProdutoDotz?.trim();

        const baseWhere = {
            vendasHeaderId,
            ...(id ? { id } : {}),
            ...(itemDocumento ? { itemDocumento } : {}),
            ...(codigoProdutoDotzFiltro ? { codigoProdutoDotz: { contains: codigoProdutoDotzFiltro } } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, {}, { itemDocumento: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, detalhes] = await Promise.all([
            s4DotzClient.vendasDetalhe.count({ where }),
            s4DotzClient.vendasDetalhe.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formattedDetalhes = detalhes.map((detalhe: any) => ({
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
            criadoEm: detalhe.criadoEm.toISOString(),
            atualizadoEm: detalhe.atualizadoEm.toISOString(),
        }));

        return {
            detalhes: formattedDetalhes,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}
