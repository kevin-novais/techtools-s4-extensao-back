import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { configuracaoContabil: { findUnique: vi.fn() } },
}));

import s4DotzClient from "@/database/clients/s4DotzClient";
import { ConfiguracaoContabilVexpenseRepository } from "@/cron/modules/vexpenses/repositories/ConfiguracaoContabilVexpenseRepository";

describe("ConfiguracaoContabilVexpenseRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mapeia as 3 colunas do header VEX", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      tipoContabilERP: "AP",
      tipoDocumentoERP: "DR",
      textoHeaderContabil: "Reembolso Vexpense",
    } as any);

    const cfg = await new ConfiguracaoContabilVexpenseRepository().buscar(7);

    expect(cfg).toEqual({ tipoArApGl: "AP", tipoDocumento: "DR", textoDocumento: "Reembolso Vexpense" });
    expect(s4DotzClient.configuracaoContabil.findUnique).toHaveBeenCalledWith({
      where: { ciaId_tipoProcesso: { ciaId: 7, tipoProcesso: "VEX" } },
      select: { tipoContabilERP: true, tipoDocumentoERP: true, textoHeaderContabil: true },
    });
  });

  it("retorna null quando nao cadastrado", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null as any);
    const cfg = await new ConfiguracaoContabilVexpenseRepository().buscar(7);
    expect(cfg).toBeNull();
  });

  it("textoDocumento vira '' quando textoHeaderContabil for null", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      tipoContabilERP: "AP", tipoDocumentoERP: "DR", textoHeaderContabil: null,
    } as any);
    const cfg = await new ConfiguracaoContabilVexpenseRepository().buscar(7);
    expect(cfg?.textoDocumento).toBe("");
  });
});
