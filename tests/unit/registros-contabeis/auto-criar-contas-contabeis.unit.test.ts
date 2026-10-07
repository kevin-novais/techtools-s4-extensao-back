import { beforeEach, describe, expect, it, vi } from "vitest";
import { SapJournalEntryItem } from "../../../src/cron/modules/registros-contabeis/types/registros-contabeis.types";

const {
  executeApiMock,
  findManyMock,
  createManyMock,
  contasFindManyMock,
  contasCreateManyMock,
  contasCreateMock,
} = vi.hoisted(() => ({
  executeApiMock: vi.fn(),
  findManyMock: vi.fn(),
  createManyMock: vi.fn(),
  contasFindManyMock: vi.fn(),
  contasCreateManyMock: vi.fn(),
  contasCreateMock: vi.fn(),
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
    },
    contasContabeis: {
      findMany: contasFindManyMock,
      createMany: contasCreateManyMock,
      create: contasCreateMock,
    },
  },
}));

import { SyncRegistrosContabeisService } from "../../../src/cron/modules/registros-contabeis/services/SyncRegistrosContabeisService";

const createSapItemComConta = (overrides?: Partial<SapJournalEntryItem>): SapJournalEntryItem => ({
  CompanyCode: "1000",
  FiscalYear: "2026",
  AccountingDocument: "5100000001",
  AccountingDocumentItem: "001",
  ChartOfAccounts: "YCOA",
  GLAccount: "12345678",
  GLAccountLongName: "Conta de Teste",
  AlternativeGLAccount: "ECD-999",
  ...overrides,
});

describe("SyncRegistrosContabeisService - DTZ-249 auto-criar contas contábeis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    createManyMock.mockResolvedValue({ count: 1 });
    contasFindManyMock.mockResolvedValue([]);
    contasCreateManyMock.mockResolvedValue({ count: 1 });
    contasCreateMock.mockResolvedValue({});
  });

  it("cria a conta contábil quando a gl_account do registro novo ainda não existe", async () => {
    executeApiMock.mockResolvedValue({ items: [createSapItemComConta()], totalItens: 1, skip: 0, top: 100 });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(result.contasCriadas).toBe(1);
    expect(contasCreateManyMock).toHaveBeenCalledTimes(1);

    const row = contasCreateManyMock.mock.calls[0][0].data[0];
    expect(row).toMatchObject({
      ChartOfAccounts: "YCOA",
      CompanyCode: "1000",
      GLAccount: "12345678",
      GLAccountName: "Conta de Teste",
      GLAccountECD: "ECD-999",
      XtpgAtivado: false,
    });
    expect(row.DataAlteracao).toBeInstanceOf(Date);
    // mapping do card: item de fluxo/cosif/datas ficam vazios (não enviados)
    expect(row.ItemFluxoDeCaixa).toBeUndefined();
    expect(row.GLAccountCosif).toBeUndefined();
    expect(row.DataInicio).toBeUndefined();
    expect(row.DataFim).toBeUndefined();
  });

  it("não cria a conta quando ela já existe em contas_contabeis", async () => {
    executeApiMock.mockResolvedValue({ items: [createSapItemComConta()], totalItens: 1, skip: 0, top: 100 });
    contasFindManyMock.mockResolvedValue([
      { ChartOfAccounts: "YCOA", CompanyCode: "1000", GLAccount: "12345678" },
    ]);

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(result.contasCriadas).toBe(0);
    expect(contasCreateManyMock).not.toHaveBeenCalled();
  });

  it("não consulta contas_contabeis quando o registro não tem chart/gl account", async () => {
    executeApiMock.mockResolvedValue({
      items: [createSapItemComConta({ ChartOfAccounts: undefined, GLAccount: undefined })],
      totalItens: 1,
      skip: 0,
      top: 100,
    });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(result.contasCriadas).toBe(0);
    expect(contasFindManyMock).not.toHaveBeenCalled();
    expect(contasCreateManyMock).not.toHaveBeenCalled();
  });

  it("deduplica a mesma conta vinda em vários registros (um único insert)", async () => {
    executeApiMock.mockResolvedValue({
      items: [
        createSapItemComConta({ AccountingDocumentItem: "001" }),
        createSapItemComConta({ AccountingDocumentItem: "002" }),
      ],
      totalItens: 2,
      skip: 0,
      top: 100,
    });
    contasCreateManyMock.mockResolvedValue({ count: 1 });

    const service = new SyncRegistrosContabeisService();
    const result = await service.execute();

    expect(contasCreateManyMock).toHaveBeenCalledTimes(1);
    expect(contasCreateManyMock.mock.calls[0][0].data).toHaveLength(1);
    expect(result.contasCriadas).toBe(1);
  });
});
