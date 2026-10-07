import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockAssertVendasHeaderCiaAccess,
    mockUpdateVendasHeader,
    mockPublishIntegrarVendas,
} = vi.hoisted(() => ({
    mockAssertVendasHeaderCiaAccess: vi.fn(),
    mockUpdateVendasHeader: vi.fn(),
    mockPublishIntegrarVendas: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { update: mockUpdateVendasHeader },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: mockAssertVendasHeaderCiaAccess,
}));

vi.mock("../../../src/queue/producers/vendasIntegrationProducer", () => ({
    publishIntegrarVendas: mockPublishIntegrarVendas,
}));

import { VendasReprocessarController } from "../../../src/modules/vendas/controllers/VendasReprocessarController";

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
    status: "ERRO_PROC",
};

describe("VendasReprocessarController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPublishIntegrarVendas.mockResolvedValue(undefined);
        mockUpdateVendasHeader.mockResolvedValue({});
    });

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Venda não encontrada", 404),
        );

        const ctrl = new VendasReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve lançar AppError 403 quando usuário não tem acesso à CIA", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Você não tem acesso a esta CIA", 403),
        );

        const ctrl = new VendasReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }, [1]), makeRes()),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 400 quando status não é reprocessável (CONCLUIDO)", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "CONCLUIDO" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve lançar AppError 400 quando status não é reprocessável (INTEG_SAP)", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "INTEG_SAP" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve atualizar para PROCESSANDO, publicar e retornar 200 quando status é ERRO_PROC", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: baseHeader,
            cia: { id: 1 },
        });

        const ctrl = new VendasReprocessarController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockUpdateVendasHeader).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({ status: "PROCESSANDO" }),
        });
        expect(mockPublishIntegrarVendas).toHaveBeenCalledWith({ vendasHeaderId: 10 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0]).toMatchObject({ vendasHeaderId: 10 });
    });

    it("deve publicar e retornar 200 quando status é PENDENTE", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "PENDENTE" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReprocessarController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockPublishIntegrarVendas).toHaveBeenCalledWith({ vendasHeaderId: 10 });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("deve publicar e retornar 200 quando status é ERRO_INTEG_SAP", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "ERRO_INTEG_SAP" },
            cia: { id: 1 },
        });

        const ctrl = new VendasReprocessarController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockPublishIntegrarVendas).toHaveBeenCalledWith({ vendasHeaderId: 10 });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("deve reverter status anterior quando falha ao publicar na fila", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: { ...baseHeader, status: "ERRO_INTEG_SAP" },
            cia: { id: 1 },
        });
        mockPublishIntegrarVendas.mockRejectedValue(new Error("fila indisponível"));

        const ctrl = new VendasReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toThrow("fila indisponível");

        expect(mockUpdateVendasHeader).toHaveBeenCalledTimes(2);
        expect(mockUpdateVendasHeader).toHaveBeenLastCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({ status: "ERRO_INTEG_SAP" }),
        });
    });
});
