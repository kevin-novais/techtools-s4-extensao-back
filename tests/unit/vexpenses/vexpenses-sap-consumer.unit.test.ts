import { beforeEach, describe, expect, it, vi } from "vitest";

const { controleExpenseMock, sapExecuteMock } = vi.hoisted(() => ({
  controleExpenseMock: { updateMany: vi.fn() },
  sapExecuteMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { controleExpense: controleExpenseMock },
}));

vi.mock("@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry", () => ({
  IntegracaoSapCreateJournalEntryService: class {
    execute = sapExecuteMock;
  },
}));

import { processVexpensesIntegrationMessage } from "@/queue/consumers/vexpensesSapIntegrationConsumer";
import { VexpensesSAPIntegrationQueueType } from "@/queue/types/vexpensesSapIntegrationQueue.types";

const integracao = { numeroDocumento: "VEX-1", codigoCia: "0101" };

describe("processVexpensesIntegrationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controleExpenseMock.updateMany.mockResolvedValue({ count: 1 });
  });

  it("grava request e response ao integrar com sucesso (201)", async () => {
    sapExecuteMock.mockResolvedValue({ status: 201, data: { numeroDocumentoERP: "DOC-9" } });

    await processVexpensesIntegrationMessage({
      type: VexpensesSAPIntegrationQueueType.INTEGRAR_VEXPENSES_SAP,
      data: { protocolo: "VEX-1", integracao },
    } as any);

    expect(controleExpenseMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { codigoProtocoloVexpenses: "VEX-1" },
        data: expect.objectContaining({
          status: "INTEGRADO_SAP",
          codigoDocumentoERP: "DOC-9",
          request: JSON.stringify(integracao),
          response: JSON.stringify({ numeroDocumentoERP: "DOC-9" }),
        }),
      }),
    );
  });
});
