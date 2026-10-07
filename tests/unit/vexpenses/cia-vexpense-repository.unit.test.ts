import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { cia: { findFirst: vi.fn() } },
}));

import s4DotzClient from "@/database/clients/s4DotzClient";
import { CiaVexpenseRepository } from "@/cron/modules/vexpenses/repositories/CiaVexpenseRepository";

describe("CiaVexpenseRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolve ciaId pelo ciaIdSAP (codigoCia)", async () => {
    vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue({ id: 7 } as any);
    const ciaId = await new CiaVexpenseRepository().resolverCiaId("0401");
    expect(ciaId).toBe(7);
    expect(s4DotzClient.cia.findFirst).toHaveBeenCalledWith({
      where: { ciaIdSAP: "0401", deletadoEm: null },
      select: { id: true },
    });
  });

  it("retorna null quando codigoCia vazio (sem consultar)", async () => {
    const ciaId = await new CiaVexpenseRepository().resolverCiaId("");
    expect(ciaId).toBeNull();
    expect(s4DotzClient.cia.findFirst).not.toHaveBeenCalled();
  });

  it("retorna null quando CIA nao cadastrada", async () => {
    vi.mocked(s4DotzClient.cia.findFirst).mockResolvedValue(null as any);
    const ciaId = await new CiaVexpenseRepository().resolverCiaId("9999");
    expect(ciaId).toBeNull();
  });
});
