import { describe, expect, it, vi, beforeEach } from "vitest";

const { executeMock, updateMock } = vi.hoisted(() => ({
    executeMock: vi.fn(),
    updateMock: vi.fn(),
}));

vi.mock("../../../src/cron/modules/bankplus-invent/services/ConsultarBoletoBankPlusService", () => ({
    ConsultarBoletoBankPlusService: class MockConsultarBoletoBankPlusService {
        execute = executeMock;
    },
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { update: updateMock },
    },
}));

import { VendasConsultarBoletoService } from "../../../src/modules/vendas/services/VendasConsultarBoletoService";

function make404Error() {
    return Object.assign(new Error("Not Found"), {
        isAxiosError: true,
        response: { status: 404 },
    });
}

function make500Error() {
    return Object.assign(new Error("Internal Server Error"), {
        isAxiosError: true,
        response: { status: 500 },
    });
}

describe("VendasConsultarBoletoService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockResolvedValue({});
    });

    it("deve lançar AppError 400 quando status não permite nova consulta", async () => {
        const service = new VendasConsultarBoletoService();

        await expect(
            service.execute({ vendasHeaderId: 10, status: "CONCLUIDO" }),
        ).rejects.toMatchObject({ statusCode: 400 });

        expect(executeMock).not.toHaveBeenCalled();
    });

    it("deve retornar o resultado quando a consulta é bem-sucedida (ERRO_BOLETO)", async () => {
        executeMock.mockResolvedValue({
            vendasHeaderId: 10,
            documentoId: "S4P#1#2026#1",
            pathBoleto: "/tmp/boleto-10.pdf",
        });

        const service = new VendasConsultarBoletoService();
        const resultado = await service.execute({ vendasHeaderId: 10, status: "ERRO_BOLETO" });

        expect(resultado).toEqual({
            vendasHeaderId: 10,
            documentoId: "S4P#1#2026#1",
            pathBoleto: "/tmp/boleto-10.pdf",
        });
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("aceita status AGUARDANDO_BOLETO", async () => {
        executeMock.mockResolvedValue({
            vendasHeaderId: 10,
            documentoId: "S4P#1#2026#1",
            pathBoleto: "/tmp/boleto-10.pdf",
        });

        const service = new VendasConsultarBoletoService();
        await expect(
            service.execute({ vendasHeaderId: 10, status: "AGUARDANDO_BOLETO" }),
        ).resolves.toBeDefined();
    });

    it("quando o BankPlus retorna 404, marca AGUARDANDO_BOLETO e relança AppError 502 com mensagem curta", async () => {
        executeMock.mockRejectedValue(make404Error());

        const service = new VendasConsultarBoletoService();
        await expect(
            service.execute({ vendasHeaderId: 11, status: "ERRO_BOLETO" }),
        ).rejects.toMatchObject({
            statusCode: 502,
            message: "Erro ao consultar boleto no BankPlus (status 404)",
        });

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 11 },
            data: expect.objectContaining({
                status: "AGUARDANDO_BOLETO",
                erroConsultaBoleto: null,
                retornoConsultaBoletoInvent: expect.stringContaining("404"),
                dataUltimaConsultaBoleto: expect.any(Date),
            }),
        });
    });

    it("quando o BankPlus retorna erro diferente de 404, marca ERRO_BOLETO e relança AppError 502 com mensagem curta", async () => {
        executeMock.mockRejectedValue(make500Error());

        const service = new VendasConsultarBoletoService();
        await expect(
            service.execute({ vendasHeaderId: 12, status: "ERRO_BOLETO" }),
        ).rejects.toMatchObject({
            statusCode: 502,
            message: "Erro ao consultar boleto no BankPlus (status 500)",
        });

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 12 },
            data: expect.objectContaining({
                status: "ERRO_BOLETO",
                erroConsultaBoleto: expect.stringContaining("500"),
                retornoConsultaBoletoInvent: expect.stringContaining("500"),
                dataUltimaConsultaBoleto: expect.any(Date),
            }),
        });
    });
});
