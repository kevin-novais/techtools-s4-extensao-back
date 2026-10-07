import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMock, sendVendasRelatorioEmailMock } = vi.hoisted(() => ({
    updateMock: vi.fn(),
    sendVendasRelatorioEmailMock: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { update: updateMock },
    },
}));

vi.mock("../../../src/util/emails/vendasRelatorioEmail", () => ({
    sendVendasRelatorioEmail: sendVendasRelatorioEmailMock,
}));

vi.mock("../../../src/util/emails/welcomeEmail", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("../../../src/util/emails/forgotPasswordEmail", () => ({ sendForgotPasswordEmail: vi.fn() }));
vi.mock("../../../src/util/emails/fornecedorRelatorioEmail", () => ({ sendFornecedorRelatorioEmail: vi.fn() }));

import { processEmailMessage } from "../../../src/queue/consumers/emailConsumer";
import { EmailType } from "../../../src/queue/types/emailQueue.types";

describe("processEmailMessage (VENDAS_RELATORIO)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockResolvedValue({});
    });

    it("grava dataEnvioEmail, destinatarioEmail e retornoEnvioEmail na venda depois do envio ser confirmado", async () => {
        sendVendasRelatorioEmailMock.mockResolvedValue({
            accepted: ["fornecedor@example.com"],
            rejected: [],
        });

        await processEmailMessage({
            type: EmailType.VENDAS_RELATORIO,
            timestamp: new Date(),
            data: {
                vendasHeaderId: 10,
                email: "fornecedor@example.com",
            },
        } as any);

        expect(sendVendasRelatorioEmailMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 10 },
            data: {
                dataEnvioEmail: expect.any(Date),
                destinatarioEmail: "fornecedor@example.com",
                retornoEnvioEmail: JSON.stringify([
                    { email: "fornecedor@example.com", status: "ENVIADO" },
                ]),
            },
        });
    });

    it("grava retornoEnvioEmail com status por destinatario quando ha falha parcial", async () => {
        sendVendasRelatorioEmailMock.mockResolvedValue({
            accepted: ["ok@example.com"],
            rejected: ["invalido@example.com"],
        });

        await processEmailMessage({
            type: EmailType.VENDAS_RELATORIO,
            timestamp: new Date(),
            data: {
                vendasHeaderId: 13,
                email: "ok@example.com,invalido@example.com",
            },
        } as any);

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 13 },
            data: {
                dataEnvioEmail: expect.any(Date),
                destinatarioEmail: "ok@example.com,invalido@example.com",
                retornoEnvioEmail: JSON.stringify([
                    { email: "ok@example.com", status: "ENVIADO" },
                    { email: "invalido@example.com", status: "ERRO" },
                ]),
            },
        });
    });

    it("nao grava auditoria e propaga o erro quando o envio falha", async () => {
        sendVendasRelatorioEmailMock.mockRejectedValue(new Error("SMTP indisponivel"));

        await expect(
            processEmailMessage({
                type: EmailType.VENDAS_RELATORIO,
                timestamp: new Date(),
                data: {
                    vendasHeaderId: 11,
                    email: "fornecedor@example.com",
                },
            } as any),
        ).rejects.toThrow("SMTP indisponivel");

        expect(updateMock).not.toHaveBeenCalled();
    });

    it("nao grava auditoria e lanca erro quando nenhum destinatario aceita o email", async () => {
        sendVendasRelatorioEmailMock.mockResolvedValue({
            accepted: [],
            rejected: ["invalido@example.com"],
        });

        await expect(
            processEmailMessage({
                type: EmailType.VENDAS_RELATORIO,
                timestamp: new Date(),
                data: {
                    vendasHeaderId: 14,
                    email: "invalido@example.com",
                },
            } as any),
        ).rejects.toThrow(/Nenhum destinatário aceitou/);

        expect(updateMock).not.toHaveBeenCalled();
    });

    it("nao propaga erro quando o envio funciona mas a gravacao da auditoria falha (nao pode causar reenvio)", async () => {
        sendVendasRelatorioEmailMock.mockResolvedValue({
            accepted: ["fornecedor@example.com"],
            rejected: [],
        });
        updateMock.mockRejectedValue(new Error("timeout no banco"));

        await expect(
            processEmailMessage({
                type: EmailType.VENDAS_RELATORIO,
                timestamp: new Date(),
                data: {
                    vendasHeaderId: 12,
                    email: "fornecedor@example.com",
                },
            } as any),
        ).resolves.toBeUndefined();
    });
});
