import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalheListParams {
    configuracaoContabilId: number;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    codigoItem?: string;
    grupoPisCofins?: keyof typeof GrupoPisConfinsTypes;
}

interface ConfiguracaoContabilDetalheListItem {
    id: number;
    configuracaoContabilId: number;
    codigoItem: string | null;
    grupoPisCofins: string;
    validarDivergencia: boolean;
    aliquotaPis: number | null;
    aliquotaCofins: number | null;
    contaCreditoPis: string | null;
    contaDebitoPis: string | null;
    contaCreditoCofins: string | null;
    contaDebitoCofins: string | null;
    contaCreditoValorProduto: string | null;
    contaDebitoValorProduto: string | null;
    contaCreditoValorFrete: string | null;
    contaDebitoValorFrete: string | null;
    contaCreditoValorCombo: string | null;
    contaDebitoValorCombo: string | null;
    contaCreditoValorIs: string | null;
    contaDebitoValorIs: string | null;
    contaCreditoValorCbs: string | null;
    contaDebitoValorCbs: string | null;
    contaCreditoValorIbsUf: string | null;
    contaDebitoValorIbsUf: string | null;
    contaCreditoValorIbsMunicipal: string | null;
    contaDebitoValorIbsMunicipal: string | null;
    centroCusto: string | null;
    centroLucro: string | null;
    criadoPor: number;
    criadoEm: string;
    atualizadoPor: number;
    atualizadoEm: string;
}

interface ConfiguracaoContabilDetalheRecord {
    id: number;
    configuracaoContabilId: number;
    codigoItem: string | null;
    grupoPisCofins: string;
    validarDivergencia: boolean;
    aliquotaPis: Prisma.Decimal | null;
    aliquotaCofins: Prisma.Decimal | null;
    contaCreditoPis: string | null;
    contaDebitoPis: string | null;
    contaCreditoCofins: string | null;
    contaDebitoCofins: string | null;
    contaCreditoValorProduto: string | null;
    contaDebitoValorProduto: string | null;
    contaCreditoValorFrete: string | null;
    contaDebitoValorFrete: string | null;
    contaCreditoValorCombo: string | null;
    contaDebitoValorCombo: string | null;
    contaCreditoValorIs: string | null;
    contaDebitoValorIs: string | null;
    contaCreditoValorCbs: string | null;
    contaDebitoValorCbs: string | null;
    contaCreditoValorIbsUf: string | null;
    contaDebitoValorIbsUf: string | null;
    contaCreditoValorIbsMunicipal: string | null;
    contaDebitoValorIbsMunicipal: string | null;
    centroCusto: string | null;
    centroLucro: string | null;
    criadoPor: number;
    criadoEm: Date;
    atualizadoPor: number;
    atualizadoEm: Date;
}

interface ConfiguracaoContabilDetalheListResponse {
    detalhes: ConfiguracaoContabilDetalheListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class ConfiguracaoContabilDetalheListService {
    async execute(params: ConfiguracaoContabilDetalheListParams): Promise<ConfiguracaoContabilDetalheListResponse> {
        const {
            configuracaoContabilId,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            codigoItem,
            grupoPisCofins,
        } = params;

        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const codigoItemFiltro = codigoItem?.trim();

        const baseWhere = {
            configuracaoContabilId,
            ...(id ? { id } : {}),
            ...(grupoPisCofins ? { grupoPisCofins } : {}),
            ...(codigoItemFiltro ? { codigoItem: { contains: codigoItemFiltro } } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, {}, { id: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, detalhes] = await Promise.all([
            s4DotzClient.configuracaoContabilDetalhe.count({ where }),
            s4DotzClient.configuracaoContabilDetalhe.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = detalhes.map((detalhe: ConfiguracaoContabilDetalheRecord) => ({
            id: detalhe.id,
            configuracaoContabilId: detalhe.configuracaoContabilId,
            codigoItem: detalhe.codigoItem,
            grupoPisCofins: detalhe.grupoPisCofins,
            validarDivergencia: detalhe.validarDivergencia,
            centroCusto: detalhe.centroCusto,
            centroLucro: detalhe.centroLucro,
            criadoEm: formatDateToBrazilianTimezone(detalhe.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(detalhe.atualizadoEm),
        }));

        return {
            detalhes: formatted,
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

