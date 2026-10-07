import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

interface ConfiguracaoContabilListParams {
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    ciaId?: number;
    tipoProcesso?: keyof typeof TipoProcesso;
    periodoDeDiferimento?: number;
    tipoContabilERP?: string;
    textoHeaderContabil?: string;
    taxaExpiracao?: number;
}

interface ConfiguracaoContabilListItem {
    id: number;
    tipoProcesso: string;
    tipoDocumentoERP: string;
    ciaId: number;
    cia: { id: number; nome: string };
    periodoDeDiferimento: number | null;
    tipoContabilERP: string;
    textoHeaderContabil: string | null;
    taxaExpiracao: number | null;
    criadoPor: number;
    criadoEm: string;
    atualizadoPor: number;
    atualizadoEm: string;
}

interface ConfiguracaoContabilRecord {
    id: number;
    tipoProcesso: string;
    tipoDocumentoERP: string;
    ciaId: number;
    cia: { id: number; nome: string };
    periodoDeDiferimento: number | null;
    tipoContabilERP: string;
    textoHeaderContabil: string | null;
    taxaExpiracao: { toNumber: () => number } | null;
    criadoPor: number;
    criadoEm: Date;
    atualizadoPor: number;
    atualizadoEm: Date;
}

interface ConfiguracaoContabilListResponse {
    configuracoes: ConfiguracaoContabilListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class ConfiguracaoContabilListService {
    async execute(params: ConfiguracaoContabilListParams = {}): Promise<ConfiguracaoContabilListResponse> {
        const {
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            ciaId,
            tipoProcesso,
            periodoDeDiferimento,
            tipoContabilERP,
            textoHeaderContabil,
            taxaExpiracao,
        } = params;

        const baseWhere = {
            ...(id ? { id } : {}),
            ...(ciaId ? { ciaId } : {}),
            ...(tipoProcesso ? { tipoProcesso } : {}),
            ...(periodoDeDiferimento ? { periodoDeDiferimento } : {}),
            ...(tipoContabilERP ? { tipoContabilERP } : {}),
            ...(textoHeaderContabil ? { textoHeaderContabil: { contains: textoHeaderContabil } } : {}),
            ...(taxaExpiracao !== undefined ? { taxaExpiracao } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, {}, { id: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, configuracoes] = await Promise.all([
            s4DotzClient.configuracaoContabil.count({ where }),
            s4DotzClient.configuracaoContabil.findMany({
                where,
                select: {
                    id: true,
                    tipoProcesso: true,
                    tipoDocumentoERP: true,
                    ciaId: true,
                    cia: { select: { id: true, nome: true } },
                    periodoDeDiferimento: true,
                    tipoContabilERP: true,
                    textoHeaderContabil: true,
                    taxaExpiracao: true,
                    criadoPor: true,
                    criadoEm: true,
                    atualizadoPor: true,
                    atualizadoEm: true,
                },
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = configuracoes.map((config: ConfiguracaoContabilRecord) => ({
            id: config.id,
            tipoProcesso: config.tipoProcesso,
            tipoDocumentoERP: config.tipoDocumentoERP,
            ciaId: config.ciaId,
            cia: config.cia,
            periodoDeDiferimento: config.periodoDeDiferimento,
            tipoContabilERP: config.tipoContabilERP,
            textoHeaderContabil: config.textoHeaderContabil,
            taxaExpiracao: config.taxaExpiracao ? config.taxaExpiracao.toNumber() : null,
            criadoPor: config.criadoPor,
            criadoEm: formatDateToBrazilianTimezone(config.criadoEm),
            atualizadoPor: config.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(config.atualizadoEm),
        }));

        return {
            configuracoes: formatted,
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
