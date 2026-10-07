import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { controleExpense: { deleteMany: vi.fn() } },
}));

import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";
import s4DotzClient from "@/database/clients/s4DotzClient";

describe("VexpensesApprovedReportsService.reprocessReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("remove placeholders, reprocessa o report e enfileira integracoes", async () => {
    const service = new VexpensesApprovedReportsService();

    (service as any).vexpensesApi = {
      getReport: vi.fn().mockResolvedValue({ id: 10, user_id: 5, approval_date: null }),
    };
    vi.mocked(s4DotzClient.controleExpense.deleteMany).mockResolvedValue({ count: 1 } as any);

    const buildExpenseTypeMap = vi
      .spyOn(service as any, "buildExpenseTypeIntegrationMap")
      .mockResolvedValue(new Map());
    const processReport = vi.spyOn(service as any, "processReport").mockResolvedValue({});
    const buildIntegrationJson = vi
      .spyOn(service as any, "buildIntegrationJson")
      .mockResolvedValue([{ numeroDocumento: "VEX-5" }]);
    const enqueue = vi.spyOn(service as any, "enqueueIntegrations").mockResolvedValue(undefined);

    await service.reprocessReport(10);

    expect(s4DotzClient.controleExpense.deleteMany).toHaveBeenCalledWith({
      where: { reportId: 10, paying_company_id: null, status: "DESCARTADO" },
    });
    expect(buildExpenseTypeMap).toHaveBeenCalled();
    expect(processReport).toHaveBeenCalledWith(
      10, 5, undefined, expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), null, true,
    );
    expect(buildIntegrationJson).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith([{ numeroDocumento: "VEX-5" }]);
  });
});
