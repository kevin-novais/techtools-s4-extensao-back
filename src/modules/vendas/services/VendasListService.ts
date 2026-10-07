import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import {
    agGridSortModelToPrismaOrderBy,
    agGridToPrismaFilters,
    mergePrismaWhere,
    parseAgGridFilterModel,
} from "@/util/filter";
import { buildPublicFileUrl } from "@/util/file-url";
import { getVendasCiaFilter } from "@/modules/vendas/utils/getVendasCiaFilter";
import { VENDAS_LIST_SELECT } from "@/modules/vendas/utils/vendasHeaderSelect";
import type { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";

interface VendasListParams {
    ciaIds: number[];
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    ciaId?: number;
    status?: StatusVendas;
    codigoClienteSAP?: string;
    numeroDocumentoAnalyzer?: string;
    dataEmissaoInicio?: Date;
    dataEmissaoFim?: Date;
    dataLancamentoContabilInicio?: Date;
    dataLancamentoContabilFim?: Date;
    dataIntegracaoInicio?: Date;
    dataIntegracaoFim?: Date;
    criadoEmInicio?: Date;
    criadoEmFim?: Date;
    atualizadoEmInicio?: Date;
    atualizadoEmFim?: Date;
}

interface VendasListResponse {
    vendas: Array<{
        id: number;
        ciaId: number | null;
        ciaIdSAP: string;
        ciaNome: string | null;
        status: string;
        tipoCadastro: string;
        codigoClienteAnalyzer: string | null;
        codigoClienteSAP: string | null;
        codigoDocumentoERP: string | null;
        cardName: string | null;
        numeroDocumentoAnalyzer: string | null;
        valorTotalVendas: string | null;
        dataEmissao: string | null;
        dataLancamentoContabil: string | null;
        dataVencimento: string | null;
        dataIntegracao: string | null;
        relatorioPdf: string | null;
        relatorioXlsx: string | null;
        retornoConsultaBoletoInvent: string | null;
        dataUltimaConsultaBoleto: string | null;
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

export class VendasListService {
    async execute(params: VendasListParams): Promise<VendasListResponse> {
        const {
            ciaIds,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            ciaId,
            status,
            codigoClienteSAP,
            numeroDocumentoAnalyzer,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        } = params;

        const ciaIdsSAP = await getVendasCiaFilter(ciaIds);

        if (ciaIdsSAP.length === 0) {
            return this.buildEmptyResponse(page, limit);
        }

        const ciaIdFiltro = await this.resolveCiaIdFiltro(ciaIdsSAP, ciaId);

        // Busca todos os ciaIdSAP cadastrados para incluir registros sem CIA vinculada
        const allKnownCiaIds = await this.fetchAllKnownCiaIdsSAP();

        const baseWhere = this.buildBaseWhere({
            ciaIdFiltro,
            allKnownCiaIdsSAP: ciaId ? undefined : allKnownCiaIds,
            id,
            status,
            codigoClienteSAP,
            numeroDocumentoAnalyzer,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        });

        // cardName e ciaNome são campos enriquecidos pós-query, não existem no model Prisma
        const virtualFields = new Set(["cardName", "ciaNome"]);

        const agGridWhere = this.buildAgGridWhere(filterModel, virtualFields);
        const where = mergePrismaWhere(baseWhere, agGridWhere);

        const ignoredFieldMap: Record<string, string> = { cardName: "", ciaNome: "" };
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, ignoredFieldMap, { criadoEm: "desc" });

        const skip = (page - 1) * limit;

        const [totalItems, vendas] = await Promise.all([
            s4DotzClient.vendasHeader.count({ where }),
            s4DotzClient.vendasHeader.findMany({
                where,
                select: VENDAS_LIST_SELECT,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        // Enriquecer com nome do cliente SAP
        const uniqueClientCodes = [
            ...new Set(
                vendas
                    .map((v: { codigoClienteSAP: string | null }) => v.codigoClienteSAP)
                    .filter((c: string | null): c is string => c !== null && c !== undefined)
            ),
        ];

        const clientes =
            uniqueClientCodes.length > 0
                ? await dotzStageClient().oCRD.findMany({
                      where: { CardCode: { in: uniqueClientCodes } },
                      select: { CardCode: true, CardName: true },
                  })
                : [];

        const clienteMap = new Map(
            clientes.map((c: { CardCode: string; CardName: string | null }) => [c.CardCode, c.CardName])
        );

        // Buscar IDs internos e nomes das CIAs
        const uniqueCiaIds = [...new Set(vendas.map((v: { ciaIdSAP: string }) => v.ciaIdSAP))];
        const cias = await s4DotzClient.cia.findMany({
            where: {
                ciaIdSAP: { in: uniqueCiaIds },
                deletadoEm: null,
            },
            select: { id: true, ciaIdSAP: true, nome: true },
        });

        const ciaNomeMap = new Map(
            cias
                .filter((c: { ciaIdSAP: string | null }) => c.ciaIdSAP !== null)
                .map((c: { id: number; ciaIdSAP: string | null; nome: string }) => [c.ciaIdSAP, c.nome])
        );

        const ciaIdMap = new Map(
            cias
                .filter((c: { ciaIdSAP: string | null }) => c.ciaIdSAP !== null)
                .map((c: { id: number; ciaIdSAP: string | null }) => [c.ciaIdSAP, c.id])
        );

        const formattedVendas = vendas.map((venda: any) => ({
            id: venda.id,
            ciaId: ciaIdMap.get(venda.ciaIdSAP) ?? null,
            ciaIdSAP: venda.ciaIdSAP,
            ciaNome: ciaNomeMap.get(venda.ciaIdSAP) ?? null,
            status: venda.status,
            tipoCadastro: venda.tipoCadastro,
            codigoClienteAnalyzer: venda.codigoClienteAnalyzer,
            codigoClienteSAP: venda.codigoClienteSAP,
            codigoDocumentoERP: venda.codigoDocumentoERP,
            cardName: venda.codigoClienteSAP ? clienteMap.get(venda.codigoClienteSAP) ?? null : null,
            numeroDocumentoAnalyzer: venda.numeroDocumentoAnalyzer,
            valorTotalVendas: venda.valorTotalVendas ? venda.valorTotalVendas.toString() : null,
            dataEmissao: formatDateOnly(venda.dataEmissao),
            dataLancamentoContabil: formatDateOnly(venda.dataLancamentoContabil),
            dataVencimento: formatDateOnly(venda.dataVencimento),
            dataIntegracao: formatDateOnly(venda.dataIntegracao),
            relatorioPdf: buildPublicFileUrl(venda.relatorioPdf),
            relatorioXlsx: buildPublicFileUrl(venda.relatorioXlsx),
            retornoConsultaBoletoInvent: venda.retornoConsultaBoletoInvent,
            dataUltimaConsultaBoleto: formatDateToBrazilianTimezone(venda.dataUltimaConsultaBoleto),
            criadoEm: formatDateToBrazilianTimezone(venda.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(venda.atualizadoEm),
        }));

        return {
            vendas: formattedVendas,
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

    private async fetchAllKnownCiaIdsSAP(): Promise<string[]> {
        const cias = await s4DotzClient.cia.findMany({
            where: { deletadoEm: null, ciaIdSAP: { not: null } },
            select: { ciaIdSAP: true },
        });
        return cias
            .map((c: { ciaIdSAP: string | null }) => c.ciaIdSAP)
            .filter((sap: string | null): sap is string => Boolean(sap?.trim()))
            .map((sap: string) => sap.trim());
    }

    private buildEmptyResponse(page: number, limit: number): VendasListResponse {
        return {
            vendas: [],
            pagination: {
                currentPage: page,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: limit,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        };
    }

    private async resolveCiaIdFiltro(ciaIdsSAP: string[], ciaId?: number): Promise<string[]> {
        if (!ciaId) return ciaIdsSAP;

        const cia = await s4DotzClient.cia.findFirst({
            where: {
                id: ciaId,
                deletadoEm: null,
                ciaIdSAP: { not: null },
            },
            select: { ciaIdSAP: true },
        });

        const ciaIdSAPFiltro = cia?.ciaIdSAP?.trim();
        if (!ciaIdSAPFiltro || !ciaIdsSAP.includes(ciaIdSAPFiltro)) {
            return [];
        }

        return [ciaIdSAPFiltro];
    }

    private buildBaseWhere(params: {
        ciaIdFiltro: string[];
        allKnownCiaIdsSAP?: string[];
        id?: number;
        status?: StatusVendas;
        codigoClienteSAP?: string;
        numeroDocumentoAnalyzer?: string;
        dataEmissaoInicio?: Date;
        dataEmissaoFim?: Date;
        dataLancamentoContabilInicio?: Date;
        dataLancamentoContabilFim?: Date;
        dataIntegracaoInicio?: Date;
        dataIntegracaoFim?: Date;
        criadoEmInicio?: Date;
        criadoEmFim?: Date;
        atualizadoEmInicio?: Date;
        atualizadoEmFim?: Date;
    }) {
        const {
            ciaIdFiltro,
            allKnownCiaIdsSAP,
            id,
            status,
            codigoClienteSAP,
            numeroDocumentoAnalyzer,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        } = params;

        const ciaWhere = allKnownCiaIdsSAP
            ? { OR: [{ ciaIdSAP: { in: ciaIdFiltro } }, { ciaIdSAP: { notIn: allKnownCiaIdsSAP } }] }
            : { ciaIdSAP: { in: ciaIdFiltro } };

        return {
            ...ciaWhere,
            ...this.buildOptionalField("id", id),
            ...this.buildOptionalField("status", status),
            ...this.buildOptionalContains("codigoClienteSAP", codigoClienteSAP),
            ...this.buildOptionalContains("numeroDocumentoAnalyzer", numeroDocumentoAnalyzer),
            ...this.buildOptionalDateRange("dataEmissao", dataEmissaoInicio, dataEmissaoFim),
            ...this.buildOptionalDateRange("dataLancamentoContabil", dataLancamentoContabilInicio, dataLancamentoContabilFim),
            ...this.buildOptionalDateRange("dataIntegracao", dataIntegracaoInicio, dataIntegracaoFim),
            ...this.buildOptionalDateRange("criadoEm", criadoEmInicio, criadoEmFim),
            ...this.buildOptionalDateRange("atualizadoEm", atualizadoEmInicio, atualizadoEmFim),
        };
    }

    private buildOptionalField<T>(field: string, value?: T | null) {
        if (value === undefined || value === null) return {};
        return { [field]: value };
    }

    private buildOptionalContains(field: string, value?: string | null) {
        if (!value) return {};
        const normalized = value.trim();
        if (!normalized) return {};
        return { [field]: { contains: normalized } };
    }

    private buildOptionalDateRange(field: string, start?: Date, end?: Date) {
        if (!start && !end) return {};
        return {
            [field]: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
            },
        };
    }

    private buildAgGridWhere(filterModel?: string, virtualFields?: Set<string>) {
        const parsed = parseAgGridFilterModel(filterModel);
        if (!parsed) return {};

        if (virtualFields && virtualFields.size > 0) {
            for (const key of virtualFields) {
                delete parsed[key];
            }
        }

        if (Object.keys(parsed).length === 0) return {};

        return agGridToPrismaFilters(parsed as any, {});
    }
}
