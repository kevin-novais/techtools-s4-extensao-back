import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockAssertVendasHeaderCiaAccess, mockExecute } = vi.hoisted(() => ({
    mockAssertVendasHeaderCiaAccess: vi.fn(),
    mockExecute: vi.fn(),
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: mockAssertVendasHeaderCiaAccess,
}));

vi.mock("../../../src/modules/vendas/services/VendasConsultarBoletoService", () => ({
    VendasConsultarBoletoService: class MockVendasConsultarBoletoService {
        execute = mockExecute;
    },
}));

import { VendasConsultarBoletoController } from "../../../src/modules/vendas/controllers/VendasConsultarBoletoController";

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
    status: "ERRO_BOLETO",
};

describe("VendasConsultarBoletoController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando venda não encontrada", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Venda não encontrada", 404),
        );

        const ctrl = new VendasConsultarBoletoController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 404 });

        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("deve lançar AppError 403 quando usuário não tem acesso à CIA", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockRejectedValue(
            new AppError("Você não tem acesso a esta CIA", 403),
        );

        const ctrl = new VendasConsultarBoletoController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve chamar o service com vendasHeaderId e status, e retornar 200", async () => {
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: baseHeader,
            cia: { id: 1 },
        });
        mockExecute.mockResolvedValue({
            vendasHeaderId: 10,
            documentoId: "S4P#1#2026#1",
            pathBoleto: "/tmp/boleto-10.pdf",
        });

        const ctrl = new VendasConsultarBoletoController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10" }), res);

        expect(mockExecute).toHaveBeenCalledWith({ vendasHeaderId: 10, status: "ERRO_BOLETO" });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0]).toMatchObject({ vendasHeaderId: 10 });
    });

    it("propaga o erro (AppError 502) lançado pelo service", async () => {
        const { default: AppError } = await import("../../../src/util/AppError");
        mockAssertVendasHeaderCiaAccess.mockResolvedValue({
            header: baseHeader,
            cia: { id: 1 },
        });
        mockExecute.mockRejectedValue(new AppError("Erro BankPlus (500)", 502));

        const ctrl = new VendasConsultarBoletoController();
        await expect(
            ctrl.handle(makeReq({ id: "10" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 502 });
    });
});
