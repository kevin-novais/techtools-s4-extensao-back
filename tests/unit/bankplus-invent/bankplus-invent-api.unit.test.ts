import axios from "axios";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BankPlusInventApi } from "../../../src/cron/modules/bankplus-invent/http/BankPlusInventApi";
import AppError from "../../../src/util/AppError";

vi.mock("axios", () => ({
    default: {
        create: vi.fn(),
        isAxiosError: (err: any): boolean => err?.isAxiosError === true,
    },
}));

vi.mock("@/config/config", () => ({
    Config: {
        BANKPLUS_INVENT_BASE_URL: "https://bankplus-cobranca-stg.invent.app.br",
        BANKPLUS_INVENT_USERNAME: "user-stg",
        BANKPLUS_INVENT_PASSWORD: "pass-stg",
        BANKPLUS_INVENT_APLICACAO: "8.BankPlus.Cobranca",
        BANKPLUS_INVENT_TENANT_ID: "DOTZ",
    },
}));

const PDF_BUFFER = Buffer.from("fake-pdf-content");

function mockAxiosOnce(handlers: { post?: ReturnType<typeof vi.fn>; get?: ReturnType<typeof vi.fn> }) {
    vi.mocked(axios.create).mockReturnValueOnce(handlers as any);
}

function authSuccessResponse(overrides: Partial<{ token: string; expiresIn: number }> = {}) {
    const expiresIn = overrides.expiresIn ?? Math.floor(Date.now() / 1000) + 3600;
    return {
        data: {
            token: overrides.token ?? "TOKEN_A",
            expiresIn,
            tokenType: null,
            url: "https://bankplus-cobranca-stg.invent.app.br",
        },
    };
}

function makeAxiosError(status: number) {
    return Object.assign(new Error(String(status)), {
        isAxiosError: true,
        response: { status },
    });
}

describe("BankPlusInventApi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        BankPlusInventApi.resetTokenCacheForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("autentica e chama /api/cobranca/pdfs na primeira consulta", async () => {
        const postMock = vi.fn().mockResolvedValue(authSuccessResponse());
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getMock });

        const api = new BankPlusInventApi();
        const result = await api.getBoletoPdf("S4P#1000#2026#1900002341#DR#BP123");

        expect(postMock).toHaveBeenCalledWith("/authenticate", {
            username: "user-stg",
            Password: "pass-stg",
        });
        expect(getMock).toHaveBeenCalledWith("/api/cobranca/pdfs", {
            params: { documentoId: "S4P#1000#2026#1900002341#DR#BP123" },
        });
        expect(result).toBeInstanceOf(Buffer);
    });

    it("envia headers Aplicacao e TenantId na autenticação", async () => {
        const postMock = vi.fn().mockResolvedValue(authSuccessResponse());
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getMock });

        await new BankPlusInventApi().getBoletoPdf("doc-1");

        const firstCreateCall = vi.mocked(axios.create).mock.calls[0][0];
        expect(firstCreateCall).toMatchObject({
            baseURL: "https://bankplus-cobranca-stg.invent.app.br",
            headers: {
                Aplicacao: "8.BankPlus.Cobranca",
                TenantId: "DOTZ",
                "Content-Type": "application/json",
            },
        });
    });

    it("envia Accept: application/pdf e responseType arraybuffer na consulta do boleto", async () => {
        const postMock = vi.fn().mockResolvedValue(authSuccessResponse());
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getMock });

        await new BankPlusInventApi().getBoletoPdf("doc-1");

        const secondCreateCall = vi.mocked(axios.create).mock.calls[1][0] as any;
        expect(secondCreateCall).toMatchObject({
            headers: { Accept: "application/pdf" },
            responseType: "arraybuffer",
        });
    });

    it("reutiliza token cacheado em chamadas consecutivas", async () => {
        const postMock = vi.fn().mockResolvedValue(authSuccessResponse());
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getMock });
        mockAxiosOnce({ get: getMock });

        const api = new BankPlusInventApi();
        await api.getBoletoPdf("doc-1");
        await api.getBoletoPdf("doc-2");

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledTimes(2);
    });

    it("re-autentica após cruzar o TTL do token (usa fake timers)", async () => {
        const baseNow = new Date("2026-04-15T10:00:00Z");
        vi.useFakeTimers();
        vi.setSystemTime(baseNow);

        const expiresInEpoch = Math.floor(baseNow.getTime() / 1000) + 300;

        const postMockFirst = vi.fn().mockResolvedValue(
            authSuccessResponse({ token: "TOKEN_A", expiresIn: expiresInEpoch }),
        );
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });
        const postMockSecond = vi.fn().mockResolvedValue(authSuccessResponse({ token: "TOKEN_B" }));

        mockAxiosOnce({ post: postMockFirst });
        mockAxiosOnce({ get: getMock });

        const api = new BankPlusInventApi();
        await api.getBoletoPdf("doc-1");

        mockAxiosOnce({ get: getMock });
        vi.setSystemTime(new Date(baseNow.getTime() + 70_000));
        await api.getBoletoPdf("doc-still-valid");
        expect(postMockFirst).toHaveBeenCalledTimes(1);
        expect(postMockSecond).toHaveBeenCalledTimes(0);

        mockAxiosOnce({ post: postMockSecond });
        mockAxiosOnce({ get: getMock });
        vi.setSystemTime(new Date(baseNow.getTime() + 250_000));
        const result = await api.getBoletoPdf("doc-needs-refresh");

        expect(postMockSecond).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(Buffer);
    });

    it("reautentica após 5min mesmo se o token ainda não expirou pelo próprio TTL (teto de cache)", async () => {
        const baseNow = new Date("2026-04-15T10:00:00Z");
        vi.useFakeTimers();
        vi.setSystemTime(baseNow);

        // TTL de 24h, bem além do teto de cache de 5min — simula o cenário real do BankPlus.
        const expiresInEpoch = Math.floor(baseNow.getTime() / 1000) + 24 * 60 * 60;

        const postMockFirst = vi.fn().mockResolvedValue(
            authSuccessResponse({ token: "TOKEN_A", expiresIn: expiresInEpoch }),
        );
        const getMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });
        const postMockSecond = vi.fn().mockResolvedValue(authSuccessResponse({ token: "TOKEN_B" }));

        mockAxiosOnce({ post: postMockFirst });
        mockAxiosOnce({ get: getMock });

        const api = new BankPlusInventApi();
        await api.getBoletoPdf("doc-1");

        mockAxiosOnce({ get: getMock });
        vi.setSystemTime(new Date(baseNow.getTime() + 4 * 60 * 1000));
        await api.getBoletoPdf("doc-ainda-dentro-do-teto");
        expect(postMockFirst).toHaveBeenCalledTimes(1);
        expect(postMockSecond).toHaveBeenCalledTimes(0);

        mockAxiosOnce({ post: postMockSecond });
        mockAxiosOnce({ get: getMock });
        vi.setSystemTime(new Date(baseNow.getTime() + 6 * 60 * 1000));
        const result = await api.getBoletoPdf("doc-passou-do-teto");

        expect(postMockSecond).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(Buffer);
    });

    it("invalida cache e retenta uma vez quando /pdfs retorna 401", async () => {
        const postMock = vi.fn()
            .mockResolvedValueOnce(authSuccessResponse({ token: "TOKEN_STALE" }))
            .mockResolvedValueOnce(authSuccessResponse({ token: "TOKEN_FRESH" }));

        const getFailingMock = vi.fn().mockRejectedValue(makeAxiosError(401));
        const getSuccessMock = vi.fn().mockResolvedValue({ data: PDF_BUFFER });

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getFailingMock });
        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getSuccessMock });

        const result = await new BankPlusInventApi().getBoletoPdf("doc-1");

        expect(postMock).toHaveBeenCalledTimes(2);
        expect(getFailingMock).toHaveBeenCalledTimes(1);
        expect(getSuccessMock).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(Buffer);
    });

    it("propaga erro quando a retentativa após 401 também falha com 401", async () => {
        const postMock = vi.fn()
            .mockResolvedValueOnce(authSuccessResponse({ token: "TOKEN_1" }))
            .mockResolvedValueOnce(authSuccessResponse({ token: "TOKEN_2" }));
        const secondError = makeAxiosError(401);

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: vi.fn().mockRejectedValue(makeAxiosError(401)) });
        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: vi.fn().mockRejectedValue(secondError) });

        await expect(new BankPlusInventApi().getBoletoPdf("doc-1")).rejects.toBe(secondError);
        expect(postMock).toHaveBeenCalledTimes(2);
    });

    it("propaga erros não-401 sem retry", async () => {
        const postMock = vi.fn().mockResolvedValue(authSuccessResponse());
        const serverError = makeAxiosError(500);
        const getMock = vi.fn().mockRejectedValue(serverError);

        mockAxiosOnce({ post: postMock });
        mockAxiosOnce({ get: getMock });

        await expect(new BankPlusInventApi().getBoletoPdf("doc-1")).rejects.toBe(serverError);
        expect(getMock).toHaveBeenCalledTimes(1);
    });

    it("lança AppError 400 quando documentoId é vazio", async () => {
        await expect(new BankPlusInventApi().getBoletoPdf("")).rejects.toMatchObject({
            statusCode: 400,
        });
        expect(vi.mocked(axios.create)).not.toHaveBeenCalled();
    });

    it("lança AppError 502 quando /authenticate retorna payload inválido", async () => {
        const postMock = vi.fn().mockResolvedValue({ data: { token: null, expiresIn: null } });
        mockAxiosOnce({ post: postMock });

        await expect(new BankPlusInventApi().getBoletoPdf("doc-1")).rejects.toMatchObject({
            statusCode: 502,
        });
    });

    it("lança AppError 400 quando documentoId é somente espaços", async () => {
        await expect(new BankPlusInventApi().getBoletoPdf("   ")).rejects.toBeInstanceOf(AppError);
    });
});
