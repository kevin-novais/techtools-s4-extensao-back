import { describe, it, expect } from "vitest";
import { buildMovimentoResolvido } from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";
import { XTPG_SPEC_PREVISTO, XTPG_SPEC_REALIZADO } from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";

describe("XTPG realizado - OrigemSistema", () => {
  it.each(["AR", "AP", "GL", "CP"])(
    "envia o conteudo cru de Diario_original2 sem conversao (%s)",
    (valor) => {
      const mov = buildMovimentoResolvido({ Diario_original2: valor }, XTPG_SPEC_REALIZADO);
      expect(mov.byTag.OrigemSistema).toBe(valor);
    },
  );

  it("OrigemSistema fica vazio quando a coluna nao vem na view", () => {
    const mov = buildMovimentoResolvido({}, XTPG_SPEC_REALIZADO);
    expect(mov.byTag.OrigemSistema).toBe("");
  });
});

describe("XTPG realizado - OrigemPk (DTZ-240)", () => {
  it("OrigemPk vem do campo Chave_da_transacao", () => {
    const mov = buildMovimentoResolvido(
      { Chave_da_transacao: "10000-500000", Nr_Doc_SAP: "999" },
      XTPG_SPEC_REALIZADO,
    );
    expect(mov.byTag.OrigemPk).toBe("10000-500000");
  });
});

describe("XTPG realizado - snapshot sav_* (DTZ-240)", () => {
  it("congela os 5 campos de compensacao/reversao da view", () => {
    const mov = buildMovimentoResolvido(
      {
        clearing_accounting_document: "5100000104",
        clearing_doc_fiscal_year: "2026",
        clearing_item: "001",
        reverse_document: "5100000200",
        reverse_document_fiscal_year: "2026",
      },
      XTPG_SPEC_REALIZADO,
    );
    expect(mov.savFields).toEqual({
      savClearAccDoc: "5100000104",
      savClearDocFiscalYear: "2026",
      savClearItem: "001",
      savRevDoc: "5100000200",
      savRevDocFiscalYear: "2026",
    });
  });

  it("campos ausentes viram null", () => {
    const mov = buildMovimentoResolvido({ clearing_accounting_document: "5100000104" }, XTPG_SPEC_REALIZADO);
    expect(mov.savFields).toEqual({
      savClearAccDoc: "5100000104",
      savClearDocFiscalYear: null,
      savClearItem: null,
      savRevDoc: null,
      savRevDocFiscalYear: null,
    });
  });

  it("previsto nao tem snapshot sav_* (savFields null)", () => {
    const mov = buildMovimentoResolvido({ CardName: "Fulano" }, XTPG_SPEC_PREVISTO);
    expect(mov.savFields).toBeNull();
  });
});
