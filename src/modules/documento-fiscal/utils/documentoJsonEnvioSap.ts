/**
 * Conteúdo de `documento_fiscal_header.documento_json`: um único objeto JSON
 * (não um array na raiz) com os payloads enviados ao SAP (`createJournalEntry`).
 * Compatível com dados legados onde a coluna guardava apenas `JSON.stringify(payload[])`.
 */

export const DOCUMENTO_JSON_ENVIO_SAP_VERSAO = 1 as const;

export type DocumentoJsonEnvioSapTipo = "createJournalEntry";

export interface DocumentoFiscalPayloadEnvioSap {
    versao: typeof DOCUMENTO_JSON_ENVIO_SAP_VERSAO;
    tipo: DocumentoJsonEnvioSapTipo;
    documentoFiscalHeaderId: number;
    geradoEm: string;
    /** Um objeto por fornecedor — corpo enviado ao endpoint SAP por chamada */
    payloads: unknown[];
}

export function serializeDocumentoJsonEnvioSap(
    documentoFiscalHeaderId: number,
    payloads: object[]
): string {
    const envelope: DocumentoFiscalPayloadEnvioSap = {
        versao: DOCUMENTO_JSON_ENVIO_SAP_VERSAO,
        tipo: "createJournalEntry",
        documentoFiscalHeaderId,
        geradoEm: new Date().toISOString(),
        payloads,
    };
    return JSON.stringify(envelope, null, 2);
}

export function parsePayloadEnvioSap(
    raw: string | null | undefined,
    documentoFiscalHeaderIdFallback: number
): DocumentoFiscalPayloadEnvioSap | null {
    if (raw === null || raw === undefined || typeof raw !== "string" || raw.trim() === "") {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return {
                versao: DOCUMENTO_JSON_ENVIO_SAP_VERSAO,
                tipo: "createJournalEntry",
                documentoFiscalHeaderId: documentoFiscalHeaderIdFallback,
                geradoEm: "",
                payloads: parsed,
            };
        }

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        const o = parsed as Record<string, unknown>;

        if (!Array.isArray(o.payloads)) {
            return null;
        }

        return {
            versao: DOCUMENTO_JSON_ENVIO_SAP_VERSAO,
            tipo: "createJournalEntry",
            documentoFiscalHeaderId:
                typeof o.documentoFiscalHeaderId === "number"
                    ? o.documentoFiscalHeaderId
                    : documentoFiscalHeaderIdFallback,
            geradoEm: typeof o.geradoEm === "string" ? o.geradoEm : "",
            payloads: o.payloads as unknown[],
        };
    } catch {
        return null;
    }
}
