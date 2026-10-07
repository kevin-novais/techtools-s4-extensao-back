import { vi } from "vitest";

export const channelMock = {
    assertExchange: vi.fn().mockResolvedValue({}),
    assertQueue: vi.fn().mockResolvedValue({}),
    bindQueue: vi.fn().mockResolvedValue({}),
    sendToQueue: vi.fn().mockReturnValue(true),
    publish: vi.fn().mockReturnValue(true),
    consume: vi.fn().mockResolvedValue({ consumerTag: "fake-tag" }),
    ack: vi.fn(),
    nack: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/queue/config/rabbitmq", () => {
    return {
        QUEUES: {
            EMAIL: "email.queue",
            EMAIL_DLQ: "email.dlq",
            DOCUMENTO_FISCAL: "documento-fiscal.queue",
            DOCUMENTO_FISCAL_DLQ: "documento-fiscal.dlq",
            SAP_INTEGRATION: "sap-integration.queue",
            SAP_INTEGRATION_DLQ: "sap-integration.dlq",
            VEXPENSES_INTEGRATION: "vexpenses-integration.queue",
            VEXPENSES_INTEGRATION_DLQ: "vexpenses-integration.dlq",
            VENDAS_INTEGRATION: "vendas-integration.queue",
            VENDAS_INTEGRATION_DLQ: "vendas-integration.dlq",
            VENDA_REC_DIFERIDA_INTEGRATION: "venda-rec-diferida-integration.queue",
            VENDA_REC_DIFERIDA_INTEGRATION_DLQ: "venda-rec-diferida-integration.dlq",
            VENDA_REC_DIFERIDA_REVERSAO: "venda-rec-diferida-reversao.queue",
            VENDA_REC_DIFERIDA_REVERSAO_DLQ: "venda-rec-diferida-reversao.dlq",
        },
        EXCHANGES: {
            EMAIL_DLX: "email.dlx",
            DOCUMENTO_FISCAL_DLX: "documento-fiscal.dlx",
            SAP_INTEGRATION_DLX: "sap-integration.dlx",
            VEXPENSES_INTEGRATION_DLX: "vexpenses-integration.dlx",
            VENDAS_INTEGRATION_DLX: "vendas-integration.dlx",
            VENDA_REC_DIFERIDA_INTEGRATION_DLX: "venda-rec-diferida-integration.dlx",
            VENDA_REC_DIFERIDA_REVERSAO_DLX: "venda-rec-diferida-reversao.dlx",
        },
        rabbitmqConnection: {
            connect: vi.fn().mockResolvedValue(undefined),
            getChannel: vi.fn().mockResolvedValue(channelMock),
            disconnect: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true),
        },
    };
});
