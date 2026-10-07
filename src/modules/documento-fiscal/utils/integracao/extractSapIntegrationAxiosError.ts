/**
 * Extrai mensagem útil, status HTTP e corpo da resposta SAP a partir de erros do Axios
 * (ou objetos com formato semelhante). Usado no IntegrationRunner e na DLQ do consumer.
 */
export function extractSapIntegrationAxiosError(error: unknown): {
    mensagem: string;
    httpStatus: number;
    corpo?: unknown;
} {
    const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
    };

    const httpStatus =
        typeof err.response?.status === "number" ? err.response.status : 500;
    const data = err.response?.data;

    const fromBody = pickMensagemFromSapBody(data);
    const mensagemFallback =
        fromBody ??
        stringBodyIfPlain(data) ??
        (typeof err.message === "string" ? err.message : null);

    const base = {
        mensagem: mensagemFallback ?? "Erro desconhecido",
        httpStatus,
    };

    if (data === undefined) {
        return base;
    }

    return { ...base, corpo: data };
}

function stringBodyIfPlain(data: unknown): string | null {
    if (typeof data === "string" && data.trim()) {
        return data;
    }
    return null;
}

function pickMensagemFromSapBody(data: unknown): string | null {
    if (!data || typeof data !== "object") {
        return null;
    }

    const record = data as Record<string, unknown>;
    const custom = mensagemFromDotzShape(record);
    if (custom) {
        return custom;
    }

    return mensagemFromODataShape(record);
}

function mensagemFromDotzShape(record: Record<string, unknown>): string | null {
    const msgObj = record.mensagem;

    if (msgObj && typeof msgObj === "object" && msgObj !== null && "erro" in msgObj) {
        const erroVal = (msgObj as { erro?: unknown }).erro;
        if (erroVal === undefined || erroVal === null) {
            return null;
        }
        if (typeof erroVal === "string") {
            return erroVal;
        }
        if (typeof erroVal === "number" || typeof erroVal === "boolean") {
            return String(erroVal);
        }
        try {
            return JSON.stringify(erroVal);
        } catch {
            return "[mensagem_erro_nao_serializavel]";
        }
    }

    if (typeof msgObj === "string") {
        return msgObj;
    }

    return null;
}

function mensagemFromODataShape(record: Record<string, unknown>): string | null {
    const errorBlob = record.error;
    if (!errorBlob || typeof errorBlob !== "object") {
        return null;
    }

    const eb = errorBlob as Record<string, unknown>;
    const innerMsg = eb.message;

    if (typeof innerMsg === "object" && innerMsg !== null && "value" in innerMsg) {
        const v = (innerMsg as { value?: unknown }).value;
        if (typeof v === "string") {
            return v;
        }
    }

    if (typeof innerMsg === "string") {
        return innerMsg;
    }

    return null;
}
