import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalhePontoListParams {
    configuracaoContabilId: number;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    codigoPonto?: string;
    grupoPisCofins?: keyof typeof GrupoPisConfinsTypes;
    ehPadrao?: boolean;
}

interface ConfiguracaoContabilDetalhePontoRecord {
    id: number;
    configuracaoContabilId: number;
    ehPadrao: boolean;
    codigoPonto: string | null;
    descricaoPonto: string | null;
    custoPonto: Prisma.Decimal | null;
    contaCredito: string | null;
    contaDebito: string | null;
    centroCusto: string | null;
    centroLucro: string | null;
    contaCreditoReceitaExpiracao: string | null;
    contaCreditoReceitaVendas: string | null;
    contaCreditoReceitaResgate: string | null;
    grupoPisCofins: string;
    aliquotaPis: Prisma.Decimal | null;
    aliquotaCofins: Prisma.Decimal | null;
    criadoPor: number;
    criadoEm: Date;
    atualizadoPor: number;
    atualizadoEm: Date;
}

export class ConfiguracaoContabilDetalhePontoListService {
    async execute(params: ConfiguracaoContabilDetalhePontoListParams) {
        const {
            configuracaoContabilId,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            codigoPonto,
            grupoPisCofins,
            ehPadrao,
        } = params;

        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const codigoPontoFiltro = codigoPonto?.trim();

        const baseWhere = {
            configuracaoContabilId,
            ...(id ? { id } : {}),
            ...(grupoPisCofins ? { grupoPisCofins } : {}),
            ...(ehPadrao !== undefined ? { ehPadrao } : {}),
            ...(codigoPontoFiltro ? { codigoPonto: { contains: codigoPontoFiltro } } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, {}, { id: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, pontos] = await Promise.all([
            s4DotzClient.configuracaoContabilDetalhePonto.count({ where }),
            s4DotzClient.configuracaoContabilDetalhePonto.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = pontos.map((ponto: ConfiguracaoContabilDetalhePontoRecord) => ({
            id: ponto.id,
            configuracaoContabilId: ponto.configuracaoContabilId,
            ehPadrao: ponto.ehPadrao,
            codigoPonto: ponto.codigoPonto,
            descricaoPonto: ponto.descricaoPonto,
            custoPonto: ponto.custoPonto ? ponto.custoPonto.toNumber() : null,
            contaCredito: ponto.contaCredito,
            contaDebito: ponto.contaDebito,
            centroCusto: ponto.centroCusto,
            centroLucro: ponto.centroLucro,
            contaCreditoReceitaExpiracao: ponto.contaCreditoReceitaExpiracao,
            contaCreditoReceitaVendas: ponto.contaCreditoReceitaVendas,
            contaCreditoReceitaResgate: ponto.contaCreditoReceitaResgate,
            grupoPisCofins: ponto.grupoPisCofins,
            aliquotaPis: ponto.aliquotaPis ? ponto.aliquotaPis.toNumber() : null,
            aliquotaCofins: ponto.aliquotaCofins ? ponto.aliquotaCofins.toNumber() : null,
            criadoEm: formatDateToBrazilianTimezone(ponto.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(ponto.atualizadoEm),
        }));

        return {
            pontos: formatted,
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
