import { describe, expect, it } from "vitest";
import {
    extrairMensagemErroBankPlus,
    isBoletoAindaNaoEmitido,
    resumirErroBankPlus,
} from "../../../src/cron/modules/bankplus-invent/utils/bankplusErrors";

function makeAxiosError(status: number, data?: unknown, message = "Request failed") {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data },
    });
}

describe("extrairMensagemErroBankPlus", () => {
    it("retorna um JSON puro (sem prefixo de texto) com status, mensagem e corpo", () => {
        const body = { error: "invalid_token", details: "token expirado" };
        const error = makeAxiosError(401, body, "Request failed with status code 401");

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toEqual({
            status: 401,
            mensagem: "Request failed with status code 401",
            corpo: body,
        });
    });

    it("funciona para status 402", () => {
        const body = { message: "limite excedido" };
        const error = makeAxiosError(402, body);

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({ status: 402, corpo: body });
    });

    it("funciona igual para 404 (boleto ainda não emitido) — sem tratamento especial", () => {
        const body = { message: "documento não encontrado" };
        const error = makeAxiosError(404, body);

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({ status: 404, corpo: body });
    });

    it("decodifica o corpo quando a resposta vem como Buffer (responseType arraybuffer)", () => {
        const body = { error: "invalid_token" };
        const error = makeAxiosError(401, Buffer.from(JSON.stringify(body), "utf-8"));

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({ status: 401, corpo: body });
    });

    it("decodifica o corpo quando a resposta vem como ArrayBuffer", () => {
        const body = { error: "unauthorized" };
        const buffer = Buffer.from(JSON.stringify(body), "utf-8");
        const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
        );
        const error = makeAxiosError(401, arrayBuffer);

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({ status: 401, corpo: body });
    });

    it("decodifica apenas a fatia correta quando a resposta vem como TypedArray view (byteOffset != 0) sobre um buffer maior", () => {
        const body = { error: "forbidden" };
        const bodyBytes = Buffer.from(JSON.stringify(body), "utf-8");

        // Simula uma view que nao comeca no inicio do ArrayBuffer compartilhado —
        // ler o buffer inteiro (ignorando byteOffset/byteLength) pegaria lixo antes/depois.
        const padding = 5;
        const backing = new ArrayBuffer(padding + bodyBytes.byteLength + padding);
        new Uint8Array(backing, padding, bodyBytes.byteLength).set(bodyBytes);
        const view = new Uint8Array(backing, padding, bodyBytes.byteLength);

        const error = makeAxiosError(403, view);

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({ status: 403, corpo: body });
    });

    it("usa o texto puro como corpo quando o Buffer não é um JSON válido", () => {
        const error = makeAxiosError(500, Buffer.from("erro interno inesperado", "utf-8"));

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toMatchObject({
            status: 500,
            corpo: "erro interno inesperado",
        });
    });

    it("corpo vem null quando não há corpo de resposta", () => {
        const error = makeAxiosError(500, undefined, "Network Error");

        const mensagem = extrairMensagemErroBankPlus(error);

        expect(JSON.parse(mensagem)).toEqual({
            status: 500,
            mensagem: "Network Error",
            corpo: null,
        });
    });

    it("usa a mensagem do Error quando não é um erro do axios (status/corpo null)", () => {
        const mensagem = extrairMensagemErroBankPlus(new Error("falha genérica"));

        expect(JSON.parse(mensagem)).toEqual({
            status: null,
            mensagem: "falha genérica",
            corpo: null,
        });
    });

    it("retorna mensagem padrão para erro desconhecido", () => {
        const mensagem = extrairMensagemErroBankPlus("string qualquer");

        expect(JSON.parse(mensagem)).toEqual({
            status: null,
            mensagem: "Erro desconhecido",
            corpo: null,
        });
    });
});

describe("resumirErroBankPlus", () => {
    it("retorna mensagem curta com o status HTTP, sem o corpo da resposta", () => {
        const error = makeAxiosError(401, { error: "invalid_token", details: "token expirado" });

        expect(resumirErroBankPlus(error)).toBe("Erro ao consultar boleto no BankPlus (status 401)");
    });

    it("funciona para status 402", () => {
        const error = makeAxiosError(402, { message: "limite excedido" });

        expect(resumirErroBankPlus(error)).toBe("Erro ao consultar boleto no BankPlus (status 402)");
    });

    it("usa a mensagem do Error quando não é um erro do axios", () => {
        expect(resumirErroBankPlus(new Error("falha genérica"))).toBe("falha genérica");
    });

    it("retorna mensagem padrão para erro desconhecido", () => {
        expect(resumirErroBankPlus("string qualquer")).toBe(
            "Erro desconhecido ao consultar boleto no BankPlus",
        );
    });
});

describe("isBoletoAindaNaoEmitido", () => {
    it("retorna true para status 404", () => {
        expect(isBoletoAindaNaoEmitido(makeAxiosError(404))).toBe(true);
    });

    it("retorna false para outros status", () => {
        expect(isBoletoAindaNaoEmitido(makeAxiosError(401))).toBe(false);
        expect(isBoletoAindaNaoEmitido(makeAxiosError(500))).toBe(false);
    });

    it("retorna false para erros que não são do axios", () => {
        expect(isBoletoAindaNaoEmitido(new Error("erro qualquer"))).toBe(false);
    });
});
