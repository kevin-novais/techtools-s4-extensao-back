import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import type { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";

interface VendaRecDiferidaListParams {
    vendasHeaderId: number;
    ciaIds: number[];
    page?: number;
    limit?: number;
    status?: StatusVendaRecDiferida;
}

interface VendaRecDiferidaListResponse {
    parcelas: Array<{
        id: number;
        vendasHeaderId: number;
        periodoDiferimento: number;
        tipo: string;
        status: string;
        ano: number | null;
        dataEmissao: string | null;
        dataDiferimento: string | null;
        valorDiferimento: string | null;
        tipoContabilErp: string | null;
        tipoDocumentoErp: string | null;
        contaCredito: string | null;
        contaDebito: string | null;
        centroLucro: string | null;
        centroCusto: string | null;
        anoFiscalLancamento: number | null;
        dataIntegracao: string | null;
        codigoDocumentoErp: string | null;
        codigoDocumentoErpReversao: string | null;
        dataDoLancamentoDaReversao: string | null;
        anoReversao: number | null;
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

export class VendaRecDiferidaListService {
    async execute(params: VendaRecDiferidaListParams): Promise<VendaRecDiferidaListResponse> {
        const { vendasHeaderId, ciaIds, page = 1, limit = 50, status } = params;

        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        const where = {
            vendasHeaderId,
            ...(status ? { status } : {}),
        };

        const skip = (page - 1) * limit;

        const [totalItems, parcelas] = await Promise.all([
            s4DotzClient.vendaRecDiferida.count({ where }),
            s4DotzClient.vendaRecDiferida.findMany({
                where,
                orderBy: [{ periodoDiferimento: "asc" }, { tipo: "asc" }],
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            parcelas: parcelas.map((p: any) => ({
                id: p.id,
                vendasHeaderId: p.vendasHeaderId,
                periodoDiferimento: p.periodoDiferimento,
                tipo: p.tipo,
                status: p.status,
                ano: p.ano,
                dataEmissao: formatDateOnly(p.dataEmissao),
                dataDiferimento: formatDateOnly(p.dataDiferimento),
                valorDiferimento: p.valorDiferimento ? p.valorDiferimento.toString() : null,
                tipoContabilErp: p.tipoContabilErp,
                tipoDocumentoErp: p.tipoDocumentoErp,
                contaCredito: p.contaCredito,
                contaDebito: p.contaDebito,
                centroLucro: p.centroLucro,
                centroCusto: p.centroCusto,
                anoFiscalLancamento: p.anoFiscalLancamento,
                dataIntegracao: formatDateOnly(p.dataIntegracao),
                codigoDocumentoErp: p.codigoDocumentoErp,
                codigoDocumentoErpReversao: p.codigoDocumentoErpReversao,
                dataDoLancamentoDaReversao: formatDateOnly(p.dataDoLancamentoDaReversao),
                anoReversao: p.anoReversao,
                criadoEm: formatDateToBrazilianTimezone(p.criadoEm),
                atualizadoEm: formatDateToBrazilianTimezone(p.atualizadoEm),
            })),
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
