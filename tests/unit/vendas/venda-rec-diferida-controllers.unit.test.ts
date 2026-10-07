import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindUniqueParcela,
    mockFindUniqueVendasHeader,
    mockFindFirstCia,
    mockUpdateParcela,
    mockPublishIntegrar,
    mockPublishReverter,
} = vi.hoisted(() => ({
    mockFindUniqueParcela: vi.fn(),
    mockFindUniqueVendasHeader: vi.fn(),
    mockFindFirstCia: vi.fn(),
    mockUpdateParcela: vi.fn(),
    mockPublishIntegrar: vi.fn(),
    mockPublishReverter: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendaRecDiferida: {
            findUnique: mockFindUniqueParcela,
            update: mockUpdateParcela,
        },
        vendasHeader: { findUnique: mockFindUniqueVendasHeader },
        cia: { findFirst: mockFindFirstCia },
    },
}));

vi.mock("../../../src/queue/producers/vendaRecDiferidaProducer", () => ({
    publishIntegrarDiferida: mockPublishIntegrar,
    publishReverterDiferida: mockPublishReverter,
}));

vi.mock("../../../src/util/date", () => ({
    formatDateOnly: vi.fn((d: Date | null) => (d ? d.toISOString().split("T")[0] : null)),
    formatDateToBrazilianTimezone: vi.fn((d: Date) => d.toISOString()),
}));

import { VendaRecDiferidaShowController } from "../../../src/modules/vendas/controllers/VendaRecDiferidaShowController";
import { VendaRecDiferidaReprocessarController } from "../../../src/modules/vendas/controllers/VendaRecDiferidaReprocessarController";
import { VendaRecDiferidaReverterController } from "../../../src/modules/vendas/controllers/VendaRecDiferidaReverterController";
import AppError from "../../../src/util/AppError";

// --- helpers ---

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

const now = new Date("2026-03-01T10:00:00.000Z");

const baseParcela = {
    id: 5,
    vendasHeaderId: 10,
    periodoDiferimento: 2,
    tipo: "DIFERIDO_TOTAL",
    status: "INTEGRADO",
    ano: 2026,
    dataEmissao: new Date("2026-01-15T00:00:00.000Z"),
    dataDiferimento: new Date("2026-03-01T00:00:00.000Z"),
    valorDiferimento: { toString: () => "200.00" },
    tipoContabilErp: "GL",
    tipoDocumentoErp: "RD",
    contaCredito: "4000001",
    contaDebito: "1000001",
    centroLucro: "LP01",
    centroCusto: null,
    anoFiscalLancamento: 2026,
    dataIntegracao: new Date("2026-03-01T00:00:00.000Z"),
    codigoDocumentoErp: "4900000002",
    requestSap: '{"numeroDocumento":"48213-02-TOTAL"}',
    responseSap: '{"numeroDocumentoERP":"4900000002"}',
    tipoContabilErpReversao: null,
    tipoDocumentoErpReversao: null,
    contaCreditoReversao: null,
    contaDebitoReversao: null,
    centroLucroReversao: null,
    centroCustoReversao: null,
    codigoDocumentoErpReversao: null,
    dataDoLancamentoDaReversao: null,
    anoReversao: null,
    criadoEm: now,
    atualizadoEm: now,
    vendasHeader: { ciaId: 1000 },
};

// ─────────────────────────────────────────────────────────────────────────────
// VendaRecDiferidaShowController
// ─────────────────────────────────────────────────────────────────────────────

const baseVendasHeader = { id: 10, ciaIdSAP: "CIA001", status: "PENDENTE" };

describe("VendaRecDiferidaShowController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindUniqueVendasHeader.mockResolvedValue(baseVendasHeader);
    });

    it("deve lançar AppError 404 quando parcela não encontrada", async () => {
        mockFindUniqueParcela.mockResolvedValue(null);

        const ctrl = new VendaRecDiferidaShowController();
        const req = makeReq({ id: "10", difeididaId: "5" });
        const res = makeRes();

        await expect(ctrl.handle(req, res)).rejects.toMatchObject({
            message: "Parcela diferida não encontrada",
            statusCode: 404,
        });
    });

    it("deve lançar AppError 404 quando vendasHeaderId não corresponde ao param :id", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, vendasHeaderId: 99 });

        const ctrl = new VendaRecDiferidaShowController();
        const req = makeReq({ id: "10", difeididaId: "5" });
        const res = makeRes();

        await expect(ctrl.handle(req, res)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve lançar AppError 403 quando CIA não encontrada", async () => {
        mockFindUniqueParcela.mockResolvedValue(baseParcela);
        mockFindFirstCia.mockResolvedValue(null);

        const ctrl = new VendaRecDiferidaShowController();
        const req = makeReq({ id: "10", difeididaId: "5" });
        const res = makeRes();

        await expect(ctrl.handle(req, res)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 403 quando CIA não está nos ciaIds do usuário", async () => {
        mockFindUniqueParcela.mockResolvedValue(baseParcela);
        mockFindFirstCia.mockResolvedValue({ id: 99 }); // user só tem [1]

        const ctrl = new VendaRecDiferidaShowController();
        const req = makeReq({ id: "10", difeididaId: "5" }, [1]);
        const res = makeRes();

        await expect(ctrl.handle(req, res)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve retornar 200 com os dados da parcela", async () => {
        mockFindUniqueParcela.mockResolvedValue(baseParcela);
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaShowController();
        const req = makeReq({ id: "10", difeididaId: "5" });
        const res = makeRes();

        await ctrl.handle(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.id).toBe(5);
        expect(body.tipo).toBe("DIFERIDO_TOTAL");
        expect(body.status).toBe("INTEGRADO");
        expect(body.codigoDocumentoErp).toBe("4900000002");
        expect(body.requestSap).toBe('{"numeroDocumento":"48213-02-TOTAL"}');
        expect(body.responseSap).toBe('{"numeroDocumentoERP":"4900000002"}');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// VendaRecDiferidaReprocessarController
// ─────────────────────────────────────────────────────────────────────────────

describe("VendaRecDiferidaReprocessarController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindUniqueVendasHeader.mockResolvedValue(baseVendasHeader);
        mockPublishIntegrar.mockResolvedValue(undefined);
    });

    it("deve lançar AppError 404 quando parcela não encontrada", async () => {
        mockFindUniqueParcela.mockResolvedValue(null);

        const ctrl = new VendaRecDiferidaReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve lançar AppError 403 quando usuário não tem acesso à CIA", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "ERRO_INTEG" });
        mockFindFirstCia.mockResolvedValue({ id: 99 }); // fora do ciaIds [1]

        const ctrl = new VendaRecDiferidaReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }, [1]), makeRes()),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 400 quando status não é reprocessável (INTEGRADO)", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "INTEGRADO" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve lançar AppError 400 quando status não é reprocessável (REVERTIDO)", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "REVERTIDO" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReprocessarController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve publicar e retornar 200 quando status é ERRO_INTEG", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "ERRO_INTEG" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReprocessarController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), res);

        expect(mockPublishIntegrar).toHaveBeenCalledWith({ vendaRecDiferidaId: 5 });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("deve publicar e retornar 200 quando status é PENDENTE", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "PENDENTE" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReprocessarController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), res);

        expect(mockPublishIntegrar).toHaveBeenCalledWith({ vendaRecDiferidaId: 5 });
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// VendaRecDiferidaReverterController
// ─────────────────────────────────────────────────────────────────────────────

describe("VendaRecDiferidaReverterController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindUniqueVendasHeader.mockResolvedValue(baseVendasHeader);
        mockPublishReverter.mockResolvedValue(undefined);
        mockUpdateParcela.mockResolvedValue({});
    });

    it("deve lançar AppError 404 quando parcela não encontrada", async () => {
        mockFindUniqueParcela.mockResolvedValue(null);

        const ctrl = new VendaRecDiferidaReverterController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("deve lançar AppError 403 quando usuário não tem acesso à CIA", async () => {
        mockFindUniqueParcela.mockResolvedValue(baseParcela);
        mockFindFirstCia.mockResolvedValue({ id: 99 });

        const ctrl = new VendaRecDiferidaReverterController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }, [1]), makeRes()),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("deve lançar AppError 400 quando status não é INTEGRADO (PENDENTE)", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "PENDENTE" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReverterController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve lançar AppError 400 quando status não é INTEGRADO (REVERSAO_PENDENTE)", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "REVERSAO_PENDENTE" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReverterController();
        await expect(
            ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), makeRes()),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve atualizar para REVERSAO_PENDENTE, publicar e retornar 200 quando status é INTEGRADO", async () => {
        mockFindUniqueParcela.mockResolvedValue(baseParcela);
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReverterController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), res);

        expect(mockUpdateParcela).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { status: "REVERSAO_PENDENTE" },
        });
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 5 });
        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.vendaRecDiferidaId).toBe(5);
    });

    it("deve atualizar para REVERSAO_PENDENTE, publicar e retornar 200 quando status é ERRO_REVERT (reenvio)", async () => {
        mockFindUniqueParcela.mockResolvedValue({ ...baseParcela, status: "ERRO_REVERT" });
        mockFindFirstCia.mockResolvedValue({ id: 1 });

        const ctrl = new VendaRecDiferidaReverterController();
        const res = makeRes();
        await ctrl.handle(makeReq({ id: "10", difeididaId: "5" }), res);

        expect(mockUpdateParcela).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { status: "REVERSAO_PENDENTE" },
        });
        expect(mockPublishReverter).toHaveBeenCalledWith({ vendaRecDiferidaId: 5 });
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
