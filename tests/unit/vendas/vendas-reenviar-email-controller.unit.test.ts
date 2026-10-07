import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockAssertVendasHeaderCiaAccess, mockUpdateVendasHeader } = vi.hoisted(() => ({
    mockAssertVendasHeaderCiaAccess: vi.fn(),
    mockUpdateVendasHeader: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { update: mockUpdateVendasHeader },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: mockAssertVendasHeaderCiaAccess,
}));

import { VendasReenviarEmailController } from "../../../src/modules/vendas/controllers/VendasReenviarEmailController";

const makeReq = (
    params: Record<string, string> = {},
    ciaIds: number[] = [1],
): any => ({ params, query: {}, user: { ciaIds } });

const makeRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

const baseHeader = {
    id: 10,
    ciaIdSAP: "100",
    status: "ERRO_EMAIL",
};

describe("VendasReenviarEmailController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateVendasHeader.mockResolvedValue({});
    });

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Venda não encontrada", 404),
        );

        const ctrl = new VendasReenviarEmailController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve lançar AppError 403 quando usuário não tem acesso à CIA", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Você não tem acesso a esta CIA", 403),
        );

        const ctrl = new VendasReenviarEmailController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }, [1]), makeRes()),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 400 quando status não permite reenvio (PENDENTE)", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "PENDENTE" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReenviarEmailController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });

        expect(mockUpdateVendasHeader).not.toHaveBeenCalled();
    });

    it("deve lançar AppError 400 quando status não permite reenvio (ENVIANDO_EMAIL)", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "ENVIANDO_EMAIL" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReenviarEmailController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve atualizar para ENVIANDO_EMAIL e retornar 200 quando status é ERRO_EMAIL", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: baseHeader,
            cia: { id: 1 },
        });

        const ctrl = new VendasReenviarEmailController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockUpdateVendasHeader).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({ status: "ENVIANDO_EMAIL" }),
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0]).toMatchObject({ vendasHeaderId: 10 });
    });

    it("deve atualizar para ENVIANDO_EMAIL e retornar 200 quando status é CONCLUIDO", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "CONCLUIDO" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReenviarEmailController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockUpdateVendasHeader).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({ status: "ENVIANDO_EMAIL" }),
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
