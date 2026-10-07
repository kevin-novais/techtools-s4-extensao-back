import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, findManyMock, updateMock } = vi.hoisted(() => ({
    executeMock: vi.fn(),
    findManyMock: vi.fn(),
    updateMock: vi.fn(),
}));

vi.mock("@/cron/modules/bankplus-invent/services/ConsultarBoletoBankPlusService", () => ({
    ConsultarBoletoBankPlusService: class MockConsultarBoletoBankPlusService {
        execute = executeMock;
    },
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: {
            findMany: findManyMock,
            update: updateMock,
        },
    },
}));

import { consultarBoletoJob } from "../../../src/cron/jobs/consultarBoletoJob";

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

describe("consultarBoletoJob", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockResolvedValue({});
    });

    it("busca vendas com status AGUARDANDO_BOLETO e ERRO_BOLETO", async () => {
        findManyMock.mockResolvedValue([]);

        await consultarBoletoJob.task();

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: { in: ["AGUARDANDO_BOLETO", "ERRO_BOLETO"] } },
            }),
        );
    });

    it("não atualiza nada quando não há vendas aguardando boleto", async () => {
        findManyMock.mockResolvedValue([]);

        await consultarBoletoJob.task();

        expect(executeMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("quando o BankPlus retorna 404 (boleto ainda não emitido), mantém AGUARDANDO_BOLETO em vez de ERRO_BOLETO", async () => {
        findManyMock.mockResolvedValue([{ id: 10 }]);
        executeMock.mockRejectedValue(make404Error());

        await consultarBoletoJob.task();

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({
                status: "AGUARDANDO_BOLETO",
                erroConsultaBoleto: null,
                retornoConsultaBoletoInvent: expect.stringContaining("404"),
                dataUltimaConsultaBoleto: expect.any(Date),
            }),
        });
    });

    it("quando o BankPlus retorna um erro diferente de 404, marca ERRO_BOLETO", async () => {
        findManyMock.mockResolvedValue([{ id: 11 }]);
        executeMock.mockRejectedValue(make500Error());

        await consultarBoletoJob.task();

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 11 },
            data: expect.objectContaining({
                status: "ERRO_BOLETO",
                erroConsultaBoleto: expect.stringContaining("500"),
                retornoConsultaBoletoInvent: expect.stringContaining("500"),
                dataUltimaConsultaBoleto: expect.any(Date),
            }),
        });
    });

    it("não atualiza a venda quando a consulta é bem-sucedida", async () => {
        findManyMock.mockResolvedValue([{ id: 12 }]);
        executeMock.mockResolvedValue({ vendasHeaderId: 12, documentoId: "X", pathBoleto: "/tmp/x.pdf" });

        await consultarBoletoJob.task();

        expect(updateMock).not.toHaveBeenCalled();
    });

    it("processa múltiplas vendas de forma independente (sucesso, 404 e erro real)", async () => {
        findManyMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
        executeMock
            .mockResolvedValueOnce({ vendasHeaderId: 1, documentoId: "X", pathBoleto: "/tmp/x.pdf" })
            .mockRejectedValueOnce(make404Error())
            .mockRejectedValueOnce(make500Error());

        await consultarBoletoJob.task();

        expect(executeMock).toHaveBeenCalledTimes(3);
        expect(updateMock).toHaveBeenCalledTimes(2);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 2 }, data: expect.objectContaining({ status: "AGUARDANDO_BOLETO" }) }),
        );
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 3 }, data: expect.objectContaining({ status: "ERRO_BOLETO" }) }),
        );
    });
});
