import { describe, expect, it, vi, beforeEach } from "vitest";
import { AccountfyRegistrosContabeisWebhookService } from "../../../src/modules/webhooks/accountfy/services/AccountfyRegistrosContabeisWebhookService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
  default: {
    accountingDocumentItem: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    cia: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/util/date", () => ({
  formatDateOnly: vi.fn((d: Date | string | null | undefined) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

const dataInicial = new Date("2026-03-01T00:00:00.000Z");
const dataFinal = new Date("2026-03-31T23:59:59.999Z");

describe("AccountfyRegistrosContabeisWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar CONTENT e ITENS com mapeamento correto dos campos", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: "Caixa",
        DocumentItemText: "Item texto",
        AccountingDocumentHeaderText: "Header texto",
        AmountInCompanyCodeCurrency: { toNumber: () => 150.5 },
        DebitCreditCode: "H",
        AssignmentReference: "REF-001",
        CostCenter: "CC1000",
        CompanyCode: "1000",
        CompanyCodeName: "Empresa Teste",
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([
      { ciaIdSAP: "1000", cpfCnpj: "12345678000199" },
    ] as any);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.CONTENT).toMatchObject({
      TOTAL_REGISTROS: 1,
      PAGINA: 1,
      TAMANHO: 100,
    });
    expect(result.ITENS).toHaveLength(1);
    expect(result.ITENS[0]).toMatchObject({
      DATA_LANCAMENTO: "10/03/2026",
      CODIGO_CONTA: "1.1.01",
      DESC_CODIGO_CONTA: "Caixa",
      HISTORICO_LANCAMENTO: "Header texto Item texto",
      VALOR: 150.5,
      DC: "C",
      INF_ADIC_LANCAMENTO: "REF-001",
      CENTRO_CUSTO: "CC1000",
      COD_EMPRESA: "1000",
      NOME_EMPRESA: "Empresa Teste",
      CNPJ: "12345678000199",
    });
  });

  it("deve mapear DC como D quando DebitCreditCode não for H", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: "Header",
        AmountInCompanyCodeCurrency: { toNumber: () => 100 },
        DebitCreditCode: "S",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "1000",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].DC).toBe("D");
  });

  it("deve retornar VALOR sempre positivo com Math.abs", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: null,
        AmountInCompanyCodeCurrency: { toNumber: () => -250.75 },
        DebitCreditCode: "S",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "1000",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].VALOR).toBe(250.75);
  });

  it("deve concatenar HISTORICO_LANCAMENTO com AccountingDocumentHeaderText e DocumentItemText", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: "Item",
        AccountingDocumentHeaderText: "Header",
        AmountInCompanyCodeCurrency: { toNumber: () => 50 },
        DebitCreditCode: "H",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "1000",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].HISTORICO_LANCAMENTO).toBe("Header Item");
  });

  it("deve retornar HISTORICO_LANCAMENTO vazio quando header e item são null", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: null,
        AmountInCompanyCodeCurrency: { toNumber: () => 50 },
        DebitCreditCode: "H",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "1000",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].HISTORICO_LANCAMENTO).toBe("");
  });

  it("deve buscar CNPJ na tabela Cia por ciaIdSAP = CompanyCode", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: null,
        AmountInCompanyCodeCurrency: { toNumber: () => 100 },
        DebitCreditCode: "H",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "2000",
        CompanyCodeName: "Empresa 2",
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([
      { ciaIdSAP: "2000", cpfCnpj: "98765432000111" },
    ] as any);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].CNPJ).toBe("98765432000111");
    expect(s4DotzClient.cia.findMany).toHaveBeenCalledWith({
      where: { ciaIdSAP: { in: ["2000"] } },
      select: { ciaIdSAP: true, cpfCnpj: true },
    });
  });

  it("deve retornar CNPJ null quando Cia não encontrada para CompanyCode", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: null,
        AmountInCompanyCodeCurrency: { toNumber: () => 100 },
        DebitCreditCode: "H",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "9999",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].CNPJ).toBeNull();
  });

  it("deve aplicar filtro codEmpresa no where quando informado", async () => {
    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(0);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue([]);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: ["1000", "2000"],
      pagina: 1,
      tamanho: 100,
    });

    expect(s4DotzClient.accountingDocumentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          CompanyCode: { in: ["1000", "2000"] },
        }),
      })
    );
  });

  it("deve aplicar paginação com skip e take corretos", async () => {
    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(250);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue([]);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 3,
      tamanho: 50,
    });

    expect(s4DotzClient.accountingDocumentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 100,
        take: 50,
      })
    );
  });

  it("deve retornar lista vazia quando não há registros", async () => {
    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(0);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue([]);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS).toHaveLength(0);
    expect(result.CONTENT.TOTAL_REGISTROS).toBe(0);
    expect(s4DotzClient.cia.findMany).toHaveBeenCalledWith({
      where: { ciaIdSAP: { in: [] } },
      select: { ciaIdSAP: true, cpfCnpj: true },
    });
  });

  it("deve tratar AmountInCompanyCodeCurrency como number", async () => {
    const registros = [
      {
        PostingDate: new Date("2026-03-10T00:00:00.000Z"),
        GLAccount: "1.1.01",
        GLAccountLongName: null,
        DocumentItemText: null,
        AccountingDocumentHeaderText: null,
        AmountInCompanyCodeCurrency: 99.99,
        DebitCreditCode: "H",
        AssignmentReference: null,
        CostCenter: null,
        CompanyCode: "1000",
        CompanyCodeName: null,
      },
    ];

    vi.mocked(s4DotzClient.accountingDocumentItem.count).mockResolvedValue(1);
    vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValue(registros as any);
    vi.mocked(s4DotzClient.cia.findMany).mockResolvedValue([]);

    const service = new AccountfyRegistrosContabeisWebhookService();
    const result = await service.execute({
      dataInicial,
      dataFinal,
      codEmpresa: [],
      pagina: 1,
      tamanho: 100,
    });

    expect(result.ITENS[0].VALOR).toBe(99.99);
  });
});
