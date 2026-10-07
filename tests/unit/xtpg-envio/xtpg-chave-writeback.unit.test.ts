import { describe, it, expect } from "vitest";
import {
  buildMovimentoResolvido,
  parseChaveRegistro,
} from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";
import {
  XTPG_SPEC_PREVISTO,
  XTPG_SPEC_REALIZADO,
} from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";

describe("XTPG write-back — resolução da chave (registros_contabeis)", () => {
  it("previsto monta a chave a partir das 4 colunas da PK da view (XRT_SendPrevPagto)", () => {
    const row = {
      Company_code: "0101",
      fiscal_year: "2026",
      accounting_document: "1900000001",
      Accounting_document_item: "001",
    };
    const mov = buildMovimentoResolvido(row, XTPG_SPEC_PREVISTO);
    expect(mov.origem.chave).toBe("0101-2026-1900000001-001");
    expect(parseChaveRegistro(mov.origem.chave)).toEqual({
      CompanyCode: "0101",
      FiscalYear: "2026",
      AccountingDocument: "1900000001",
      AccountingDocumentItem: "001",
    });
  });

  it("previsto: chave fica nula se faltar alguma parte da PK (não marca/atualiza errado)", () => {
    const row = {
      Company_code: "0101",
      fiscal_year: "2026",
      accounting_document: "1900000001",
    };
    const mov = buildMovimentoResolvido(row, XTPG_SPEC_PREVISTO);
    expect(mov.origem.chave).toBeNull();
  });

  it("realizado monta a chave de write-back pelas 4 colunas da PK (não pela CHAVE multi-parte)", () => {
    const row = {
      Company_code: "0101",
      fiscal_year: "2026",
      accounting_document: "1800000000",
      Accounting_document_item: "1",
      CHAVE: "0101-2026-1800000000-1-1400000008",
    };
    const mov = buildMovimentoResolvido(row, XTPG_SPEC_REALIZADO);
    expect(mov.origem.chave).toBe("0101-2026-1800000000-1");
    expect(parseChaveRegistro(mov.origem.chave)).toEqual({
      CompanyCode: "0101",
      FiscalYear: "2026",
      AccountingDocument: "1800000000",
      AccountingDocumentItem: "1",
    });
  });
});
