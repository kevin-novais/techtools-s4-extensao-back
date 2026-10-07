/**
 * Envelopes SOAP 1.1 da `Saida.asmx` (DeepXRT).
 * Namespace do serviço: http://deepxrtbrasil.com.br/
 * SOAPAction = <namespace><Operação>
 *
 * Operações usadas:
 *  - ListarMovimentosContabeisPeloStatus(status: string)
 *  - MudarStatusMovimentoParContabil(parcontabil: int, status: string, critica: string)
 */

export const XTPG_SAIDA_NAMESPACE = "http://deepxrtbrasil.com.br/";

function escapeXml(value: string): string {
    return (value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export function soapActionListarMovimentos(): string {
    return `${XTPG_SAIDA_NAMESPACE}ListarMovimentosContabeisPeloStatus`;
}

export function soapActionMudarStatus(): string {
    return `${XTPG_SAIDA_NAMESPACE}MudarStatusMovimentoParContabil`;
}

/** Envelope de `ListarMovimentosContabeisPeloStatus`. */
export function buildListarMovimentosEnvelope(status: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <ListarMovimentosContabeisPeloStatus xmlns="${XTPG_SAIDA_NAMESPACE}">
      <status>${escapeXml(status)}</status>
    </ListarMovimentosContabeisPeloStatus>
  </soap:Body>
</soap:Envelope>`;
}

/** Envelope de `MudarStatusMovimentoParContabil`. */
export function buildMudarStatusEnvelope(params: {
    parContabil: string;
    status: string;
    critica: string;
}): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <MudarStatusMovimentoParContabil xmlns="${XTPG_SAIDA_NAMESPACE}">
      <parcontabil>${escapeXml(params.parContabil)}</parcontabil>
      <status>${escapeXml(params.status)}</status>
      <critica>${escapeXml(params.critica)}</critica>
    </MudarStatusMovimentoParContabil>
  </soap:Body>
</soap:Envelope>`;
}
