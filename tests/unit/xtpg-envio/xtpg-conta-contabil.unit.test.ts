import { describe, it, expect } from "vitest";
import { buildMovimentoResolvido } from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";
import { XTPG_SPEC_PREVISTO, XTPG_SPEC_REALIZADO } from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";

describe("XTPG - ContaContabil sempre com o codigo (DTZ-284)", () => {
  it("realizado envia o codigo de Conta_contabil, nao a descricao", () => {
    const mov = buildMovimentoResolvido(
      { Conta_contabil: "10010001", Descr_Conta_contabil: "Banco Itau - Ag. 8499 cc 27730-2" },
      XTPG_SPEC_REALIZADO,
    );
    expect(mov.byTag.ContaContabil).toBe("10010001");
  });

  it("realizado ignora Descr_Conta_contabil mesmo quando Conta_contabil nao vem", () => {
    const mov = buildMovimentoResolvido(
      { Descr_Conta_contabil: "Banco Itau - Ag. 8499 cc 27730-2" },
      XTPG_SPEC_REALIZADO,
    );
    expect(mov.byTag.ContaContabil).toBe("");
  });

  it("previsto continua enviando AcctCode", () => {
    const mov = buildMovimentoResolvido({ AcctCode: "24090208" }, XTPG_SPEC_PREVISTO);
    expect(mov.byTag.ContaContabil).toBe("24090208");
  });
});

describe("XTPG - InformacoesContabeis leva a contrapartida (DTZ-284)", () => {
  it("realizado separa conta de origem e contrapartida", () => {
    const mov = buildMovimentoResolvido(
      { Conta_contabil: "10010001", Conta_contrapartida: "24090208" },
      XTPG_SPEC_REALIZADO,
    );
    expect(mov.byTag.ContaContabil).toBe("10010001");
    expect(mov.byTag.InformacoesContabeis).toBe("24090208");
  });

  it("realizado nao volta a duplicar a conta de origem quando a contrapartida nao vem", () => {
    const mov = buildMovimentoResolvido({ Conta_contabil: "10010001" }, XTPG_SPEC_REALIZADO);
    expect(mov.byTag.InformacoesContabeis).toBe("");
  });

  it("previsto ja enviava a contrapartida em AcctCode e segue igual", () => {
    const mov = buildMovimentoResolvido({ AcctCode: "24090208" }, XTPG_SPEC_PREVISTO);
    expect(mov.byTag.InformacoesContabeis).toBe("24090208");
  });
});
