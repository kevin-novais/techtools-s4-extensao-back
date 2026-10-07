import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyMock, findUniqueMock } = vi.hoisted(() => ({
    verifyMock: vi.fn(),
    findUniqueMock: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
    default: { verify: verifyMock },
    verify: verifyMock,
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
    default: { usuario: { findUnique: findUniqueMock } },
}));

vi.mock("@/config/config", () => ({
    Config: { APP_API_KEY: "chave-maquina", ACCESS_TOKEN_SECRET: "segredo" },
}));

import { ensureHealthAccess } from "@/middlewares/ensure-health-access";

function makeReq(authorization?: string) {
    return { headers: { authorization }, } as any;
}

async function call(authorization?: string) {
    const req = makeReq(authorization);
    const next = vi.fn();
    let error: any = null;
    try {
        await ensureHealthAccess(req, {} as any, next);
    } catch (e) {
        error = e;
    }
    return { req, next, error };
}

describe("ensureHealthAccess (DTZ-320)", () => {
    beforeEach(() => {
        verifyMock.mockReset();
        findUniqueMock.mockReset();
    });

    it("libera com a APP_API_KEY (máquina-a-máquina), sem tocar em JWT/banco", async () => {
        const { next, error } = await call("Bearer chave-maquina");
        expect(error).toBeNull();
        expect(next).toHaveBeenCalledOnce();
        expect(verifyMock).not.toHaveBeenCalled();
        expect(findUniqueMock).not.toHaveBeenCalled();
    });

    it("libera com JWT de usuário ADMIN e anexa o user", async () => {
        verifyMock.mockReturnValue({ id: "u1" });
        findUniqueMock.mockResolvedValue({ id: "u1", email: "a@x", ativo: true, perfil: "ADMIN" });
        const { req, next, error } = await call("Bearer jwt-valido");
        expect(error).toBeNull();
        expect(next).toHaveBeenCalledOnce();
        expect(req.user.perfil).toBe("ADMIN");
    });

    it("bloqueia (403) usuário logado que NÃO é ADMIN", async () => {
        verifyMock.mockReturnValue({ id: "u2" });
        findUniqueMock.mockResolvedValue({ id: "u2", email: "b@x", ativo: true, perfil: "USER" });
        const { next, error } = await call("Bearer jwt-user");
        expect(next).not.toHaveBeenCalled();
        expect(error?.statusCode).toBe(403);
    });

    it("401 quando não há token", async () => {
        const { next, error } = await call(undefined);
        expect(next).not.toHaveBeenCalled();
        expect(error?.statusCode).toBe(401);
    });

    it("401 quando o JWT é inválido", async () => {
        verifyMock.mockImplementation(() => { throw new Error("bad"); });
        const { next, error } = await call("Bearer jwt-quebrado");
        expect(next).not.toHaveBeenCalled();
        expect(error?.statusCode).toBe(401);
    });

    it("401 quando o usuário do JWT está inativo", async () => {
        verifyMock.mockReturnValue({ id: "u3" });
        findUniqueMock.mockResolvedValue({ id: "u3", email: "c@x", ativo: false, perfil: "ADMIN" });
        const { next, error } = await call("Bearer jwt-inativo");
        expect(next).not.toHaveBeenCalled();
        expect(error?.statusCode).toBe(401);
    });
});
