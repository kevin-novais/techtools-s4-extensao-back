import axios from "axios";

interface BankPlusErroDetalhado {
    status: number | null;
    mensagem: string;
    corpo: unknown;
}

// getBoletoPdf usa responseType "arraybuffer" (espera um PDF), entao um corpo de erro em JSON chega como Buffer.
function decodeErrorBody(data: unknown): unknown {
    const isBinary =
        Buffer.isBuffer(data) || data instanceof ArrayBuffer || ArrayBuffer.isView(data);

    if (!isBinary) return data ?? null;

    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
        buffer = data;
    } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
    } else {
        const view = data as ArrayBufferView;
        buffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
    }

    const text = buffer.toString("utf-8");

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function montarErroDetalhado(error: unknown): BankPlusErroDetalhado {
    if (axios.isAxiosError(error)) {
        return {
            status: error.response?.status ?? null,
            mensagem: error.message,
            corpo: decodeErrorBody(error.response?.data),
        };
    }
    if (error instanceof Error) {
        return { status: null, mensagem: error.message, corpo: null };
    }
    return { status: null, mensagem: "Erro desconhecido", corpo: null };
}

// Mesmo formato de retornoIntegracaoSap: JSON puro (sem prefixo de texto), pra o front reformatar com JSON.parse + stringify(null, 2).
export function extrairMensagemErroBankPlus(error: unknown): string {
    return JSON.stringify(montarErroDetalhado(error));
}

// Mensagem curta para exibição ao usuário (toast/erro de API) — o JSON completo vai só pro retorno persistido.
export function resumirErroBankPlus(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        return `Erro ao consultar boleto no BankPlus (status ${status ?? "sem resposta"})`;
    }
    if (error instanceof Error) return error.message;
    return "Erro desconhecido ao consultar boleto no BankPlus";
}

export function isBoletoAindaNaoEmitido(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 404;
}
