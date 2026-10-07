export type IntegrationResultStatusSap = "sucesso" | "conflito" | "erro";

/** Linha compatível com IntegrationResult (corpo SAP opcional). */
export interface LinhaResultadoIntegracaoSap {
    codigoParceiro: string;
    status: IntegrationResultStatusSap;
    statusCode: number;
    numeroDocumentoERP?: string;
    mensagem?: string;
    corpoRespostaSap?: unknown;
}

export type RetornoIntegracaoSapOrigem =
    | "integration_runner"
    | "approve_failure"
    | "queue_dlq"
    | "build_failure";

export interface RetornoIntegracaoSapItemJson {
    codigoParceiro: string;
    httpStatus: number;
    statusIntegracao: IntegrationResultStatusSap;
    mensagem?: string;
    numeroDocumentoERP?: string;
    corpo?: unknown;
}

export interface RetornoIntegracaoSapPayload {
    atualizadoEm: string;
    origem: RetornoIntegracaoSapOrigem;
    resultados: RetornoIntegracaoSapItemJson[];
}

export function buildRetornoIntegracaoSapPayload(
    origem: RetornoIntegracaoSapOrigem,
    resultados: LinhaResultadoIntegracaoSap[]
): RetornoIntegracaoSapPayload {
    return {
        atualizadoEm: new Date().toISOString(),
        origem,
        resultados: resultados.map((r) => ({
            codigoParceiro: r.codigoParceiro,
            httpStatus: r.statusCode,
            statusIntegracao: r.status,
            mensagem: r.mensagem,
            numeroDocumentoERP: r.numeroDocumentoERP,
            corpo: r.corpoRespostaSap,
        })),
    };
}

export function serializeRetornoIntegracaoSap(payload: RetornoIntegracaoSapPayload): string {
    return JSON.stringify(payload);
}

export function parseRetornoIntegracaoSap(raw: string | null | undefined): RetornoIntegracaoSapPayload | null {
    if (raw === null || raw === undefined || typeof raw !== "string" || raw.trim() === "") {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as RetornoIntegracaoSapPayload;
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.resultados)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/** Mensagem curta para compatibilidade com clientes que esperavam erroIntegracaoSap (texto). */
export function extractLegadoMensagemSap(raw: string | null | undefined): string | null {
    const payload = parseRetornoIntegracaoSap(raw);
    if (payload) {
        const parts = payload.resultados
            .filter((r) => r.statusIntegracao === "erro")
            .map((r) => r.mensagem)
            .filter((m): m is string => Boolean(m && m.trim().length > 0));
        if (parts.length > 0) {
            return parts.join(" | ");
        }
        return null;
    }

    if (raw !== null && raw !== undefined && typeof raw === "string" && raw.trim() !== "") {
        return raw;
    }

    return null;
}
