import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    agGridToPrismaFilters,
    mergePrismaWhere,
    parseAgGridFilterModel,
} from "@/util/filter";
import AppError from "@/util/AppError";
import type { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";

interface DocumentoRecord {
    id: number;
    ciaId: number;
    codigoFornecedorSAP: string;
    codigoFornecedorAnalyzer: string;
    codigoDocumento: string;
    tipoDocumentoERP: TipoDocumentoERP;
    tipoContabilERP: string | null;
    status: string;
    romaneioUrl: string | null;
    romaneioFileName: string | null;
    nomeRomaneio: string | null;
    dataEmissao: Date;
    dataLancamentoContabil: Date;
    dataVencimento: Date;
    dataProcessamentoInicio: Date;
    dataProcessamentoFim: Date;
    dataIntegracao: Date;
    criadoPor: number;
    criadoEm: Date;
    atualizadoPor: number;
    atualizadoEm: Date;
    cia: {
        id: number;
        nome: string;
    };
}

interface DocumentoListParams {
    ciaIds: number[];
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    ciaId?: number;
    ciaNome?: string;
    status?: string;
    tipoDocumentoERP?: TipoDocumentoERP;
    tipoContabilERP?: string;
    codigoFornecedorSAP?: string;
    codigoFornecedorAnalyzer?: string;
    codigoDocumento?: string;
    criadoPor?: number;
    atualizadoPor?: number;
    dataEmissaoInicio?: Date;
    dataEmissaoFim?: Date;
    dataLancamentoContabilInicio?: Date;
    dataLancamentoContabilFim?: Date;
    dataProcessamentoInicio?: Date;
    dataProcessamentoFim?: Date;
    dataIntegracaoInicio?: Date;
    dataIntegracaoFim?: Date;
    criadoEmInicio?: Date;
    criadoEmFim?: Date;
    atualizadoEmInicio?: Date;
    atualizadoEmFim?: Date;
}

interface DocumentoListResponse {
    documentos: Array<{
        id: number;
        ciaId: number;
        codigoFornecedorSAP: string;
        cardName: string | null;
        codigoDocumento: string;
        tipoDocumentoERP: TipoDocumentoERP;
        tipoContabilERP: string | null;
        status: string;
        romaneioUrl: string | null;
        romaneioFileName: string | null;
        nomeRomaneio: string | null;
        dataEmissao: string;
        dataLancamentoContabil: string;
        dataVencimento: string;
        dataProcessamento: string;
        dataIntegracao: string;
        criadoPor: number;
        criadoEm: string;
        atualizadoPor: number;
        atualizadoEm: string;
        cia: {
            id: number;
            nome: string;
        };
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

export class DocumentoListService {
    async execute(params: DocumentoListParams): Promise<DocumentoListResponse> {
        const {
            ciaIds: ciasPermitidas,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            ciaId,
            ciaNome,
            status,
            tipoDocumentoERP,
            tipoContabilERP,
            codigoFornecedorSAP,
            codigoDocumento,
            criadoPor,
            atualizadoPor,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataProcessamentoInicio,
            dataProcessamentoFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        } = params;

        if (ciasPermitidas.length === 0) {
            return this.buildEmptyResponse(page, limit);
        }

        const ciaIdFiltro = this.resolveCiaIdFiltro(ciasPermitidas, ciaId);
        const baseWhere = this.buildBaseWhere({
            ciaIdFiltro,
            id,
            status,
            tipoDocumentoERP,
            tipoContabilERP,
            codigoFornecedorSAP,
            codigoDocumento,
            ciaNome,
            criadoPor,
            atualizadoPor,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataProcessamentoInicio,
            dataProcessamentoFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        });

        const relationMap = {
            "cia.nome": "cia",
        };

        const parsedFilterModel = parseAgGridFilterModel(filterModel);
        const { sanitizedFilterModel, codigoFornecedorTexto, hasCodigoFornecedorFilter } =
            this.extractCodigoFornecedorSapFilter(parsedFilterModel);

        const codigoFornecedorCardCodes = await this.resolveCardCodesBySupplierName(codigoFornecedorTexto);
        if (codigoFornecedorTexto && codigoFornecedorCardCodes.length === 0) {
            return this.buildEmptyResponse(page, limit);
        }

        const agGridWhere = this.resolveAgGridWhere({
            filterModel,
            sanitizedFilterModel,
            hasCodigoFornecedorFilter,
            relationMap,
        });
        const baseWhereWithAgGrid = mergePrismaWhere(baseWhere, agGridWhere);
        const codigoFornecedorWhere = codigoFornecedorCardCodes.length
            ? {
                codigoFornecedorSAP: {
                    in: codigoFornecedorCardCodes,
                },
            }
            : {};
        const where = mergePrismaWhere(baseWhereWithAgGrid, codigoFornecedorWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, relationMap, {}, { criadoEm: "desc" });

        const skip = (page - 1) * limit;

        const [totalItems, documentos] = await Promise.all([
            s4DotzClient.documentoFiscalHeader.count({ where }),
            s4DotzClient.documentoFiscalHeader.findMany({
                where,
                include: {
                    cia: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },
                },
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const uniqueCardCodes = [...new Set(documentos.map((doc: DocumentoRecord) => doc.codigoFornecedorSAP))];

        const fornecedores = await dotzStageClient().oCRD.findMany({
            where: {
                CardCode: {
                    in: uniqueCardCodes,
                },
            },
            select: {
                CardCode: true,
                CardName: true,
            },
        });

        const cardCodeToNameMap = new Map(
            fornecedores.map((f: { CardCode: string; CardName: string | null }) => [f.CardCode, f.CardName])
        );

        const formattedDocumentos = documentos.map((doc: DocumentoRecord) => ({
            id: doc.id,
            ciaId: doc.ciaId,
            codigoFornecedorSAP: doc.codigoFornecedorSAP,
            cardName: cardCodeToNameMap.get(doc.codigoFornecedorSAP) ?? null,
            codigoDocumento: doc.codigoDocumento,
            tipoDocumentoERP: doc.tipoDocumentoERP,
            tipoContabilERP: doc.tipoContabilERP,
            status: doc.status,
            romaneioUrl: doc.romaneioUrl,
            romaneioFileName: doc.romaneioFileName,
            nomeRomaneio: doc.nomeRomaneio,
            dataEmissao: formatDateOnly(doc.dataEmissao),
            dataLancamentoContabil: formatDateOnly(doc.dataLancamentoContabil),
            dataVencimento: formatDateOnly(doc.dataVencimento),
            dataProcessamentoInicio: formatDateToBrazilianTimezone(doc.dataProcessamentoInicio),
            dataProcessamentoFim: formatDateToBrazilianTimezone(doc.dataProcessamentoFim),
            dataIntegracao: formatDateOnly(doc.dataIntegracao),
            criadoPor: doc.criadoPor,
            criadoEm: formatDateToBrazilianTimezone(doc.criadoEm),
            atualizadoPor: doc.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(doc.atualizadoEm),
            cia: doc.cia,
        }));

        return {
            documentos: formattedDocumentos,
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

    private buildEmptyResponse(page: number, limit: number): DocumentoListResponse {
        return {
            documentos: [],
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

    private extractCodigoFornecedorSapFilter(filterModel: any) {
        if (!filterModel || typeof filterModel !== "object") {
            return { sanitizedFilterModel: null, codigoFornecedorTexto: null, hasCodigoFornecedorFilter: false };
        }

        const { codigoFornecedorSAP, ...rest } = filterModel;
        const codigoFornecedorTexto = this.resolveTextFilterValue(codigoFornecedorSAP);
        const sanitizedFilterModel = Object.keys(rest).length > 0 ? rest : null;

        return {
            sanitizedFilterModel,
            codigoFornecedorTexto,
            hasCodigoFornecedorFilter: Boolean(codigoFornecedorSAP),
        };
    }

    private resolveTextFilterValue(filter: any): string | null {
        if (!filter || typeof filter !== "object") return null;
        if (filter.filterType !== "text") return null;
        if (typeof filter.filter !== "string") return null;

        const value = filter.filter.trim();
        if (!value) return null;

        return value;
    }

    private resolveAgGridWhere(params: {
        filterModel?: string;
        sanitizedFilterModel: Record<string, unknown> | null;
        hasCodigoFornecedorFilter: boolean;
        relationMap: Record<string, string>;
    }) {
        const { filterModel, sanitizedFilterModel, hasCodigoFornecedorFilter, relationMap } = params;

        if (hasCodigoFornecedorFilter) {
            if (!sanitizedFilterModel) return {};
            return agGridToPrismaFilters(sanitizedFilterModel as any, relationMap);
        }

        return agGridFilterModelToPrismaWhere(filterModel, relationMap);
    }

    private async resolveCardCodesBySupplierName(value?: string | null): Promise<string[]> {
        if (!value) return [];
        const normalizedValue = value.trim();
        if (!normalizedValue) return [];

        const fornecedores = await dotzStageClient().oCRD.findMany({
            where: {
                CardName: {
                    contains: normalizedValue,
                },
            },
            select: {
                CardCode: true,
            },
        });

        if (fornecedores.length > 0) {
            return fornecedores.map((fornecedor: { CardCode: string }) => fornecedor.CardCode);
        }

        const tokens = this.normalizeTextTokens(normalizedValue);
        if (tokens.length === 0) return [];

        const fornecedoresPorTokens = await dotzStageClient().oCRD.findMany({
            where: {
                AND: tokens.map((token) => ({
                    CardName: {
                        contains: token,
                    },
                })),
            },
            select: {
                CardCode: true,
            },
        });

        if (fornecedoresPorTokens.length === 0) return [];

        return fornecedoresPorTokens.map((fornecedor: { CardCode: string }) => fornecedor.CardCode);
    }

    private normalizeTextTokens(value: string): string[] {
        if (!value) return [];

        return value
            .replaceAll(/[^\w\s]/g, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3);
    }

    private resolveCiaIdFiltro(ciasPermitidas: number[], ciaId?: number): number[] {
        if (!ciaId) return ciasPermitidas;
        if (!ciasPermitidas.includes(ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }
        return [ciaId];
    }

    private buildBaseWhere(params: {
        ciaIdFiltro: number[];
        id?: number;
        status?: string;
        tipoDocumentoERP?: TipoDocumentoERP;
        tipoContabilERP?: string;
        codigoFornecedorSAP?: string;
        codigoDocumento?: string;
        ciaNome?: string;
        criadoPor?: number;
        atualizadoPor?: number;
        dataEmissaoInicio?: Date;
        dataEmissaoFim?: Date;
        dataLancamentoContabilInicio?: Date;
        dataLancamentoContabilFim?: Date;
        dataProcessamentoInicio?: Date;
        dataProcessamentoFim?: Date;
        dataIntegracaoInicio?: Date;
        dataIntegracaoFim?: Date;
        criadoEmInicio?: Date;
        criadoEmFim?: Date;
        atualizadoEmInicio?: Date;
        atualizadoEmFim?: Date;
    }) {
        const {
            ciaIdFiltro,
            id,
            status,
            tipoDocumentoERP,
            tipoContabilERP,
            codigoFornecedorSAP,
            codigoDocumento,
            ciaNome,
            criadoPor,
            atualizadoPor,
            dataEmissaoInicio,
            dataEmissaoFim,
            dataLancamentoContabilInicio,
            dataLancamentoContabilFim,
            dataProcessamentoInicio,
            dataProcessamentoFim,
            dataIntegracaoInicio,
            dataIntegracaoFim,
            criadoEmInicio,
            criadoEmFim,
            atualizadoEmInicio,
            atualizadoEmFim,
        } = params;

        return {
            ciaId: {
                in: ciaIdFiltro,
            },
            ...this.buildOptionalField("id", id),
            ...this.buildOptionalField("status", status),
            ...this.buildOptionalField("tipoDocumentoERP", tipoDocumentoERP),
            ...this.buildOptionalContains("tipoContabilERP", tipoContabilERP),
            ...this.buildOptionalContains("codigoFornecedorSAP", codigoFornecedorSAP),
            ...this.buildOptionalContains("codigoDocumento", codigoDocumento),
            ...this.buildOptionalCiaNome(ciaNome),
            ...this.buildOptionalField("criadoPor", criadoPor),
            ...this.buildOptionalField("atualizadoPor", atualizadoPor),
            ...this.buildOptionalDateRange("dataEmissao", dataEmissaoInicio, dataEmissaoFim),
            ...this.buildOptionalDateRange(
                "dataLancamentoContabil",
                dataLancamentoContabilInicio,
                dataLancamentoContabilFim
            ),
            ...this.buildOptionalDateRange("dataProcessamento", dataProcessamentoInicio, dataProcessamentoFim),
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

    private buildOptionalCiaNome(value?: string | null) {
        if (!value) return {};
        const normalized = value.trim();
        if (!normalized) return {};
        return { cia: { nome: { contains: normalized } } };
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
}

