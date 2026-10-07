import type { FluxoCaixaCiaParceiro, FluxoCaixaCiaTipoLancamento } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";

export function formatFluxoCaixaCiaParceiro(row: FluxoCaixaCiaParceiro) {
    return {
        cardCode: row.cardCode,
        companyCode: row.companyCode,
        itemFluxoCaixa: row.itemFluxoCaixa,
        criadoEm: formatDateToBrazilianTimezone(row.criadoEm),
        atualizadoEm: formatDateToBrazilianTimezone(row.atualizadoEm),
        criadoPor: row.criadoPor,
        atualizadoPor: row.atualizadoPor,
    };
}

export function formatFluxoCaixaCiaTipoLancamento(row: FluxoCaixaCiaTipoLancamento) {
    return {
        companyCode: row.companyCode,
        postingKey: row.postingKey,
        documentType: row.documentType,
        referenceDocumentType: row.referenceDocumentType,
        isReversed: row.isReversed,
        reversalReason: row.reversalReason,
        debitCreditCode: row.debitCreditCode,
        itemFluxoCaixa: row.itemFluxoCaixa,
        criadoEm: formatDateToBrazilianTimezone(row.criadoEm),
        atualizadoEm: formatDateToBrazilianTimezone(row.atualizadoEm),
        criadoPor: row.criadoPor,
        atualizadoPor: row.atualizadoPor,
    };
}
