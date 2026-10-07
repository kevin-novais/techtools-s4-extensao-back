import { beforeEach, describe, expect, it, vi } from "vitest";
import { SapJournalEntryItem } from "../../../src/cron/modules/registros-contabeis/types/registros-contabeis.types";

const { executeApiMock, findManyMock, createManyMock, execRawMock, updateManyMock, transactionMock } =
  vi.hoisted(() => ({
    executeApiMock: vi.fn(),
    findManyMock: vi.fn(),
    createManyMock: vi.fn(),
    execRawMock: vi.fn(),
    updateManyMock: vi.fn(),
    transactionMock: vi.fn(),
  }));

vi.mock("@/cron/modules/registros-contabeis/http/RegistrosContabeisApi", () => ({
  RegistrosContabeisApi: class MockRegistrosContabeisApi {
    execute = executeApiMock;
  },
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    accountingDocumentItem: {
      findMany: findManyMock,
      createMany: createManyMock,
      updateMany: updateManyMock,
    },
    $executeRawUnsafe: execRawMock,
    $transaction: transactionMock,
  },
}));

import { SyncRegistrosContabeisService } from "../../../src/cron/modules/registros-contabeis/services/SyncRegistrosContabeisService";

const createValidSapItem = (overrides?: Partial<SapJournalEntryItem>): SapJournalEntryItem => ({
  CompanyCode: "1000",
  FiscalYear: "2026",
  AccountingDocument: "5100000001",
  AccountingDocumentItem: "001",
  ...overrides,
});

describe("SyncRegistrosContabeisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    createManyMock.mockResolvedValue({ count: 1 });
    execRawMock.mockResolvedValue(1);
    updateManyMock.mockResolvedValue({ count: 1 });
    transactionMock.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  });

  /**
   * DTZ-273: o vinculo de compensacao e a unica pista da conta de resultado de origem
   * de um pagamento, e o S/4 o apaga ao reverter a compensacao.
   */
  describe("sticky do vinculo de compensacao", () => {
    const itemExistente = {
      CompanyCode: "1000",
      FiscalYear: "2026",
      AccountingDocument: "5100000001",
      AccountingDocumentItem: "001",
    };

    it("grava o vinculo nas colunas sticky ao inserir", async () => {
      const sapItem = createValidSapItem({
        ClearingAccountingDocument: "1500000080",
        ClearingDocFiscalYear: "2026",
        ClearingItem: "2",
      });
      executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(createManyMock).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            StickyClearAccDoc: "1500000080",
            StickyClearDocFiscalYear: "2026",
            StickyClearItem: "2",
          }),
        ]),
      });
    });

    it("NAO apaga o sticky quando o S/4 devolve a compensacao vazia", async () => {
      findManyMock.mockResolvedValue([itemExistente]);
      // reversao da compensacao: o S/4 zera os clearing_*
      const sapItem = createValidSapItem({
        ClearingAccountingDocument: "",
        ClearingDocFiscalYear: "",
        ClearingItem: "",
      });
      executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(updateManyMock).toHaveBeenCalledTimes(1);
      const { data } = updateManyMock.mock.calls[0][0];
      expect(data).toHaveProperty("ClearingAccountingDocument", null);
      expect(data).not.toHaveProperty("StickyClearAccDoc");
      expect(data).not.toHaveProperty("StickyClearDocFiscalYear");
      expect(data).not.toHaveProperty("StickyClearItem");
    });

    it("NAO apaga o sticky quando o S/4 marca vazio com \"0\" no ano e no item", async () => {
      findManyMock.mockResolvedValue([itemExistente]);
      // o S/4 usa "" no documento e "0" nos campos numericos p/ sinalizar ausencia
      const sapItem = createValidSapItem({
        ClearingAccountingDocument: "",
        ClearingDocFiscalYear: "0",
        ClearingItem: "0",
      });
      executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      const { data } = updateManyMock.mock.calls[0][0];
      expect(data).not.toHaveProperty("StickyClearDocFiscalYear");
      expect(data).not.toHaveProperty("StickyClearItem");
    });

    it("resolve a conta de origem ao final do sync, apos a limpeza da reversao", async () => {
      executeApiMock.mockResolvedValue({
        items: [createValidSapItem()],
        totalItens: 1,
        skip: 0,
        top: 100,
      });
      execRawMock.mockResolvedValue(7);

      const result = await new SyncRegistrosContabeisService().execute();

      const chamadas = execRawMock.mock.calls.map((c) => String(c[0]));
      const resolucao = chamadas.filter((sql) => sql.includes("xtpg_conta_origem"));
      expect(resolucao).toHaveLength(1);
      expect(result.contaOrigemResolvida).toBe(7);
    });

    it("nao derruba o sync quando a resolucao da conta de origem falha", async () => {
      executeApiMock.mockResolvedValue({
        items: [createValidSapItem()],
        totalItens: 1,
        skip: 0,
        top: 100,
      });
      execRawMock.mockRejectedValue(new Error("timeout"));

      const result = await new SyncRegistrosContabeisService().execute();

      expect(result.contaOrigemResolvida).toBe(0);
      expect(result.inserted).toBe(1);
    });

    it("atualiza o sticky quando a compensacao chega preenchida", async () => {
      findManyMock.mockResolvedValue([itemExistente]);
      const sapItem = createValidSapItem({
        ClearingAccountingDocument: "1500000080",
        ClearingDocFiscalYear: "2026",
        ClearingItem: "2",
      });
      executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      const { data } = updateManyMock.mock.calls[0][0];
      expect(data).toMatchObject({
        StickyClearAccDoc: "1500000080",
        StickyClearDocFiscalYear: "2026",
        StickyClearItem: "2",
      });
    });
  });

  /**
   * DTZ-318: baixa de contas a pagar via BankPlus SEM doc de compensacao (clearing NULL). A
   * fatura precisa reentrar no previsto p/ ir a zero; o gatilho reseta o status na chegada do
   * pagamento (pk 21, K/D), decodificando a fatura da assignment_reference.
   */
  describe("baixa direta BankPlus (DTZ-318)", () => {
    const resetCalls = () =>
      execRawMock.mock.calls.filter(
        (c) =>
          String(c[0]).includes("SET status_para_envio = NULL") &&
          String(c[0]).includes("accounting_document_item = @P4"),
      );

    it("reseta a fatura ligada pela assignment_reference quando o pagamento BankPlus nao tem clearing", async () => {
      const pagamento = createValidSapItem({
        AccountingDocument: "1500000147",
        AccountingDocumentItem: "001",
        PostingKey: "21",
        FinancialAccountType: "K",
        AccountingDocCreatedByUser: "BANKPLUS",
        ClearingAccountingDocument: "",
        AssignmentReference: "20261900000193001",
      });
      executeApiMock.mockResolvedValue({ items: [pagamento], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      const resets = resetCalls();
      expect(resets).toHaveLength(1);
      // P1=cia, P2=ano, P3=fatura, P4=item (decodificados da assignment_reference)
      expect(resets[0].slice(1, 5)).toEqual(["1000", "2026", "1900000193", "1"]);
    });

    it("NAO reseta quando o pagamento BankPlus ja tem doc de compensacao (clearing preenchido)", async () => {
      const pagamento = createValidSapItem({
        AccountingDocument: "1500000139",
        PostingKey: "21",
        FinancialAccountType: "K",
        AccountingDocCreatedByUser: "BANKPLUS",
        ClearingAccountingDocument: "100000081",
        AssignmentReference: "20261900000171001",
      });
      executeApiMock.mockResolvedValue({ items: [pagamento], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(resetCalls()).toHaveLength(0);
    });

    it("NAO reseta um pagamento nao-BankPlus mesmo sem clearing", async () => {
      const pagamento = createValidSapItem({
        AccountingDocument: "1500000200",
        PostingKey: "21",
        FinancialAccountType: "K",
        AccountingDocCreatedByUser: "CB9980000003",
        ClearingAccountingDocument: "",
        AssignmentReference: "20261900000193001",
      });
      executeApiMock.mockResolvedValue({ items: [pagamento], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(resetCalls()).toHaveLength(0);
    });
  });

  /**
   * DTZ-318 AR: recebimento de contas a RECEBER via BankPlus SEM doc de compensacao (retorno
   * bancario, clearing NULL). A fatura AR reentra no previsto p/ ir a zero; o gatilho reseta o
   * status na chegada do recebimento (pk 11/15, D), casando a fatura por
   * payment_reference = document_reference_id (o boleto).
   */
  describe("recebimento direto BankPlus AR (DTZ-318 AR)", () => {
    const resetCalls = () =>
      execRawMock.mock.calls.filter(
        (c) =>
          String(c[0]).includes("SET status_para_envio = NULL") &&
          String(c[0]).includes("payment_reference = @P2"),
      );

    it("reseta a fatura AR pelo payment_reference quando o recebimento BankPlus (pk 11, D) nao tem clearing", async () => {
      const recebimento = createValidSapItem({
        AccountingDocument: "100000108",
        AccountingDocumentItem: "001",
        PostingKey: "11",
        FinancialAccountType: "D",
        AccountingDocCreatedByUser: "BANKPLUS",
        ClearingAccountingDocument: "",
        DocumentReferenceID: "0090000049",
      });
      executeApiMock.mockResolvedValue({ items: [recebimento], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      const resets = resetCalls();
      expect(resets).toHaveLength(1);
      // P1=cia, P2=document_reference_id (boleto) casado com payment_reference da fatura
      expect(resets[0].slice(1, 3)).toEqual(["1000", "0090000049"]);
    });

    it("NAO reseta quando o recebimento BankPlus AR ja tem doc de compensacao (clearing preenchido)", async () => {
      const recebimento = createValidSapItem({
        AccountingDocument: "100000107",
        PostingKey: "11",
        FinancialAccountType: "D",
        AccountingDocCreatedByUser: "BANKPLUS",
        ClearingAccountingDocument: "1400000046",
        DocumentReferenceID: "0090000056",
      });
      executeApiMock.mockResolvedValue({ items: [recebimento], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(resetCalls()).toHaveLength(0);
    });

    it("NAO reseta a linha do banco (pk 40) do proprio retorno bancario", async () => {
      const linhaBanco = createValidSapItem({
        AccountingDocument: "100000108",
        AccountingDocumentItem: "002",
        PostingKey: "40",
        FinancialAccountType: "S",
        AccountingDocCreatedByUser: "BANKPLUS",
        ClearingAccountingDocument: "",
        DocumentReferenceID: "0090000049",
      });
      executeApiMock.mockResolvedValue({ items: [linhaBanco], totalItens: 1, skip: 0, top: 100 });

      await new SyncRegistrosContabeisService().execute();

      expect(resetCalls()).toHaveLength(0);
    });
  });

  it("deve incluir Reference1/2/3IDByBusinessPartner no createMany quando vindos da API SAP", async () => {
    const sapItem = createValidSapItem({
      Reference1IDByBusinessPartner: "REF-001",
      Reference2IDByBusinessPartner: "REF-PARTNER-002",
      Reference3IDByBusinessPartner: "REF-LONG-DESCRIPTION-003",
    });

    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(result.inserted).toBe(1);
    expect(result.invalid).toBe(0);
    expect(executeApiMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, top: 100 }),
    );
    expect(createManyMock).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          CompanyCode: "1000",
          FiscalYear: "2026",
          AccountingDocument: "5100000001",
          AccountingDocumentItem: "001",
          Reference1IDByBusinessPartner: "REF-001",
          Reference2IDByBusinessPartner: "REF-PARTNER-002",
          Reference3IDByBusinessPartner: "REF-LONG-DESCRIPTION-003",
        }),
      ]),
    });
  });

  it("deve retornar null para Reference quando ausentes na API SAP", async () => {
    const sapItem = createValidSapItem();
    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    const createdData = createManyMock.mock.calls[0][0].data[0];
    expect(createdData.Reference1IDByBusinessPartner).toBeNull();
    expect(createdData.Reference2IDByBusinessPartner).toBeNull();
    expect(createdData.Reference3IDByBusinessPartner).toBeNull();
  });

  it("deve truncar Reference1IDByBusinessPartner quando exceder 20 caracteres", async () => {
    const longRef1 = "A".repeat(25);
    const sapItem = createValidSapItem({
      Reference1IDByBusinessPartner: longRef1,
    });

    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    const createdData = createManyMock.mock.calls[0][0].data[0];
    expect(createdData.Reference1IDByBusinessPartner).toHaveLength(20);
    expect(createdData.Reference1IDByBusinessPartner).toBe("A".repeat(20));
  });

  it("deve truncar Reference2IDByBusinessPartner quando exceder 30 caracteres", async () => {
    const longRef2 = "B".repeat(40);
    const sapItem = createValidSapItem({
      Reference2IDByBusinessPartner: longRef2,
    });

    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    const createdData = createManyMock.mock.calls[0][0].data[0];
    expect(createdData.Reference2IDByBusinessPartner).toHaveLength(30);
    expect(createdData.Reference2IDByBusinessPartner).toBe("B".repeat(30));
  });

  it("deve truncar Reference3IDByBusinessPartner quando exceder 50 caracteres", async () => {
    const longRef3 = "C".repeat(60);
    const sapItem = createValidSapItem({
      Reference3IDByBusinessPartner: longRef3,
    });

    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    const createdData = createManyMock.mock.calls[0][0].data[0];
    expect(createdData.Reference3IDByBusinessPartner).toHaveLength(50);
    expect(createdData.Reference3IDByBusinessPartner).toBe("C".repeat(50));
  });

  it("deve normalizar Reference com trim quando vier com espacos", async () => {
    const sapItem = createValidSapItem({
      Reference1IDByBusinessPartner: "  REF-TRIMMED  ",
    });

    executeApiMock.mockResolvedValue({ items: [sapItem], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    const createdData = createManyMock.mock.calls[0][0].data[0];
    expect(createdData.Reference1IDByBusinessPartner).toBe("REF-TRIMMED");
  });

  it("percorre TODAS as páginas em uma única execução (paginação in-run)", async () => {
    const paginaCheia = Array.from({ length: 100 }, (_, i) =>
      createValidSapItem({ AccountingDocument: `510000${String(i).padStart(4, "0")}` }),
    );
    const paginaFinal = Array.from({ length: 50 }, (_, i) =>
      createValidSapItem({ AccountingDocument: `520000${String(i).padStart(4, "0")}` }),
    );

    executeApiMock
      .mockResolvedValueOnce({ items: paginaCheia, totalItens: 150, skip: 0, top: 100 })
      .mockResolvedValueOnce({ items: paginaFinal, totalItens: 150, skip: 100, top: 100 });
    createManyMock.mockResolvedValue({ count: 100 });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(executeApiMock).toHaveBeenCalledTimes(2);
    expect(executeApiMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 0, top: 100 }));
    expect(executeApiMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ skip: 100, top: 100 }));
    expect(result.totalReceived).toBe(150);
  });

  it("para de paginar ao atingir total-itens (última página parcial)", async () => {
    const pagina = Array.from({ length: 30 }, (_, i) =>
      createValidSapItem({ AccountingDocument: `530000${String(i).padStart(4, "0")}` }),
    );
    executeApiMock.mockResolvedValue({ items: pagina, totalItens: 30, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    await service.execute();

    expect(executeApiMock).toHaveBeenCalledTimes(1);
  });

  it("acumula reversões de páginas distintas e limpa UMA vez ao final do run (DTZ-245)", async () => {
    const reversalPag1 = createValidSapItem({ AccountingDocument: "5900000001", IsReversal: "X" });
    const paginaCheia = [
      reversalPag1,
      ...Array.from({ length: 99 }, (_, i) =>
        createValidSapItem({ AccountingDocument: `540000${String(i).padStart(4, "0")}` }),
      ),
    ];
    const reversalPag2 = createValidSapItem({ AccountingDocument: "5900000002", IsReversal: "X" });

    executeApiMock
      .mockResolvedValueOnce({ items: paginaCheia, totalItens: 101, skip: 0, top: 100 })
      .mockResolvedValueOnce({ items: [reversalPag2], totalItens: 101, skip: 100, top: 100 });
    createManyMock.mockResolvedValue({ count: 100 });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    // conta so as limpezas: o mesmo $executeRawUnsafe atende a resolucao da conta de origem
    const limpezas = execRawMock.mock.calls.filter((c) =>
      String(c[0]).includes("clearing_accounting_document = NULL"),
    );
    expect(limpezas).toHaveLength(2);
    expect(result.revertedCleared).toBe(2);
  });
});
