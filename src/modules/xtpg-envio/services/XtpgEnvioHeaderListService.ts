/** Lista paginada dos lotes (HEADER) de envio XTPG por fluxo, com filtros. */
import { getLogDelegates } from "@/modules/xtpg-envio/utils/registroStatus";
import type { XtpgFluxo } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

export interface XtpgEnvioHeaderListParams {
    fluxo: XtpgFluxo;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    page?: number;
    limit?: number;
}

export class XtpgEnvioHeaderListService {
    async execute(params: XtpgEnvioHeaderListParams) {
        const { fluxo, status, dataInicio, dataFim, page = 1, limit = 20 } = params;
        const { header } = getLogDelegates(fluxo);

        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (dataInicio || dataFim) {
            where.criadoEm = {
                ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
                ...(dataFim ? { lte: new Date(dataFim) } : {}),
            };
        }

        const skip = (page - 1) * limit;

        const [totalItems, headers] = await Promise.all([
            header.count({ where }),
            header.findMany({
                where,
                orderBy: { id: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    status: true,
                    totalRegistros: true,
                    mensagemErro: true,
                    criadoEm: true,
                    atualizadoEm: true,
                },
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit) || 1;

        return {
            fluxo,
            headers,
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
