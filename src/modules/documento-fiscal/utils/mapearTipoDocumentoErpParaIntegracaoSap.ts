import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";

const SAP_TIPO_TROCA_PONTOS = "KR" as const;

/**
 * Tipo de documento usado no payload do SAP (createJournalEntry). TP_ROM e TP_POS
 * mapeiam para KR no ERP; o header continua com tipoDocumentoERP original.
 */
export function mapearTipoDocumentoErpParaIntegracaoSap(tipoDocumentoErp: string): string {
    if (tipoDocumentoErp === TipoDocumentoERP.TP_ROM || tipoDocumentoErp === TipoDocumentoERP.TP_POS) {
        return SAP_TIPO_TROCA_PONTOS;
    }

    return tipoDocumentoErp;
}
