import { describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    controleExpense: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import s4DotzClient from "@/database/clients/s4DotzClient";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

describe("VexpensesApprovedReportsService.resolveProtocolo", () => {
  it("gera 'VEX-<reportId>' de forma deterministica, sem consultar o banco", async () => {
    const service = new VexpensesApprovedReportsService();
    const protocolo = await (service as any).resolveProtocolo(10719470);

    expect(protocolo).toBe("VEX-10719470");
    expect(s4DotzClient.controleExpense.findFirst).not.toHaveBeenCalled();
    expect(s4DotzClient.$queryRaw).not.toHaveBeenCalled();
  });
});
