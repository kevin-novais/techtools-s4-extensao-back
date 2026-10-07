import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findManyControleExpenseMock,
  updateManyControleExpenseMock,
  findManyAccountingDocumentItemMock,
  payReportMock,
} = vi.hoisted(() => ({
  findManyControleExpenseMock: vi.fn(),
  updateManyControleExpenseMock: vi.fn(),
  findManyAccountingDocumentItemMock: vi.fn(),
  payReportMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    controleExpense: {
      findMany: findManyControleExpenseMock,
      updateMany: updateManyControleExpenseMock,
    },
    accountingDocumentItem: {
      findMany: findManyAccountingDocumentItemMock,
    },
  },
}));

import { VexpensesPaymentByClearingService } from "../../../src/cron/modules/vexpenses/services/VexpensesPaymentByClearingService";

describe("VexpensesPaymentByClearingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyControleExpenseMock.mockResolvedValue({ count: 1 });
  });

  it("deve conciliar por chave do documento (cia+ano+doc) e pagar somente uma vez por reportId", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 101, codigoDocumentoERP: "DOC123", codigoCia: "0101", fiscalYear: "2026" },
      { reportId: 101, codigoDocumentoERP: "DOC123", codigoCia: "0101", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([
      {
        CompanyCode: "0101",
        FiscalYear: "2026",
        AccountingDocument: "DOC123",
        ClearingDate: new Date("2026-03-02T12:10:00.000Z"),
      },
    ]);
    payReportMock.mockResolvedValue(undefined);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(payReportMock).toHaveBeenCalledTimes(1);
    expect(payReportMock).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        comment: "Pagamento identificado automaticamente por baixa contabil no SAP.",
        payment_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      }),
    );
    expect(updateManyControleExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportId: 101 },
        data: expect.objectContaining({
          status: "INTEGRADO_VEXPENSES",
        }),
      }),
    );
    expect(result).toEqual({
      eligibleRecords: 2,
      eligibleReports: 1,
      matchedReports: 1,
      paidReports: 1,
      ignoredReports: 0,
      errorReports: 0,
    });
  });

  it("nao deve pagar por baixa de documento homonimo de outra CIA/ano (sem colisao)", async () => {
    // Mesmo numero de documento em duas CIAs: so a 0101 tem baixa. O report da 0401 NAO pode ser pago.
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 700, codigoDocumentoERP: "1900000002", codigoCia: "0401", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([
      {
        CompanyCode: "0101",
        FiscalYear: "2026",
        AccountingDocument: "1900000002",
        ClearingDate: new Date("2026-06-12T00:00:00.000Z"),
      },
    ]);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(payReportMock).not.toHaveBeenCalled();
    expect(updateManyControleExpenseMock).not.toHaveBeenCalled();
    expect(result.ignoredReports).toBe(1);
    expect(result.paidReports).toBe(0);
  });

  it("deve pagar o report da CIA que tem a baixa quando ha documentos homonimos", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 701, codigoDocumentoERP: "1900000002", codigoCia: "0101", fiscalYear: "2026" },
      { reportId: 702, codigoDocumentoERP: "1900000002", codigoCia: "0401", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([
      {
        CompanyCode: "0101",
        FiscalYear: "2026",
        AccountingDocument: "1900000002",
        ClearingDate: new Date("2026-06-12T00:00:00.000Z"),
      },
    ]);
    payReportMock.mockResolvedValue(undefined);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(payReportMock).toHaveBeenCalledTimes(1);
    expect(payReportMock).toHaveBeenCalledWith(701, expect.any(Object));
    expect(result.paidReports).toBe(1);
    expect(result.ignoredReports).toBe(1);
  });

  it("deve ignorar report sem codigo_cia/fiscal_year (registro legado) para nao arriscar falso positivo", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 800, codigoDocumentoERP: "DOC800", codigoCia: null, fiscalYear: null },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([
      {
        CompanyCode: "0101",
        FiscalYear: "2026",
        AccountingDocument: "DOC800",
        ClearingDate: new Date("2026-03-02T12:10:00.000Z"),
      },
    ]);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(payReportMock).not.toHaveBeenCalled();
    expect(result.paidReports).toBe(0);
    expect(result.ignoredReports).toBe(1);
  });

  it("deve restringir a busca da baixa a linha do parceiro (FinancialAccountType='K')", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 900, codigoDocumentoERP: "DOC900", codigoCia: "0101", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([]);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    await service.execute();

    expect(findManyAccountingDocumentItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          FinancialAccountType: "K",
          IsCleared: "X",
        }),
      }),
    );
  });

  it("deve ignorar report quando nao houver baixa contabil (IsCleared=true com ClearingDate)", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 202, codigoDocumentoERP: "DOC404", codigoCia: "0101", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([]);

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(payReportMock).not.toHaveBeenCalled();
    expect(updateManyControleExpenseMock).not.toHaveBeenCalled();
    expect(result.ignoredReports).toBe(1);
    expect(result.paidReports).toBe(0);
  });

  it("deve marcar erro de integracao no controle_expense quando falhar no payReport", async () => {
    findManyControleExpenseMock.mockResolvedValue([
      { reportId: 303, codigoDocumentoERP: "DOC303", codigoCia: "0101", fiscalYear: "2026" },
    ]);
    findManyAccountingDocumentItemMock.mockResolvedValue([
      {
        CompanyCode: "0101",
        FiscalYear: "2026",
        AccountingDocument: "DOC303",
        ClearingDate: new Date("2026-03-03T15:00:00.000Z"),
      },
    ]);
    payReportMock.mockRejectedValue(new Error("falha no pay"));

    const service = new VexpensesPaymentByClearingService({ payReport: payReportMock });
    const result = await service.execute();

    expect(updateManyControleExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportId: 303 },
        data: expect.objectContaining({
          status: "ERRO_INTEGRACAO_VEXPENSES",
          error_message: "falha no pay",
        }),
      }),
    );
    expect(result.errorReports).toBe(1);
  });
});
