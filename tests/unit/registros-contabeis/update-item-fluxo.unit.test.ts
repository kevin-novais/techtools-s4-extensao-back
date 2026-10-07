import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateManyMock, itemFindUniqueMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  itemFindUniqueMock: vi.fn(),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    accountingDocumentItem: {
      updateMany: updateManyMock,
    },
    itemFluxoCaixa: {
      findUnique: itemFindUniqueMock,
    },
  },
}));

import { RegistrosContabeisUpdateItemFluxoService } from "@/modules/registros-contabeis/services/RegistrosContabeisUpdateItemFluxoService";
import AppError from "@/util/AppError";

const baseParams = {
  companyCode: "1000",
  fiscalYear: "2026",
  accountingDocument: "5100000001",
  accountingDocumentItem: "001",
  itemFluxoDeCaixa: "44",
};

describe("RegistrosContabeisUpdateItemFluxoService - DTZ-248", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    itemFindUniqueMock.mockResolvedValue({ codigo: "44", nome: "Pagamentos de notas fiscais para fornecedores" });
    updateManyMock.mockResolvedValue({ count: 1 });
  });

  it("atualiza item de fluxo válido e zera status_para_envio p/ reenviar", async () => {
    const service = new RegistrosContabeisUpdateItemFluxoService();
    await service.execute(baseParams);

    expect(itemFindUniqueMock).toHaveBeenCalledWith({ where: { codigo: "44" } });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        CompanyCode: "1000",
        FiscalYear: "2026",
        AccountingDocument: "5100000001",
        AccountingDocumentItem: "001",
      },
      data: {
        ItemFluxodeCaixa: "44",
        StatusParaEnvio: null,
      },
    });
  });

  it("rejeita item de fluxo inexistente na tabela item_fluxo_caixa", async () => {
    itemFindUniqueMock.mockResolvedValue(null);
    const service = new RegistrosContabeisUpdateItemFluxoService();

    await expect(
      service.execute({ ...baseParams, itemFluxoDeCaixa: "999" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("lança 404 quando o registro não existe", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    const service = new RegistrosContabeisUpdateItemFluxoService();

    await expect(service.execute(baseParams)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
