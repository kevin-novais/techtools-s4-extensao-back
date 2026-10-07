import { describe, it, expect, vi, beforeEach } from "vitest";

const { getJobsMock, findFirstMock } = vi.hoisted(() => ({
  getJobsMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock("@/cron", () => ({ cronManager: { getJobs: getJobsMock } }));
vi.mock("@/database/clients/s4DotzClient", () => ({
  default: { integrationExecutionLog: { findFirst: findFirstMock } },
}));

import { IntegracoesListService } from "@/modules/integracoes/services/IntegracoesListService";

describe("IntegracoesListService", () => {
  beforeEach(() => {
    getJobsMock.mockReset();
    findFirstMock.mockReset();
  });

  it("lista só jobs com key, mapeia a última execução e ordena por label", async () => {
    getJobsMock.mockReturnValue([
      { name: "B", key: "b", label: "Beta", schedule: "*/5 * * * *", manualTrigger: true },
      { name: "SemKey", schedule: "* * * * *" },
      { name: "A", key: "a", label: "Alfa", schedule: "0 9 * * *", manualTrigger: true },
    ]);
    findFirstMock.mockImplementation(async (args: { where: { integrationKey: string } }) => {
      if (args.where.integrationKey === "a") {
        return {
          status: "SUCCESS",
          triggerType: "SCHEDULED",
          startedAt: new Date(),
          finishedAt: new Date(),
          totalReceived: 5,
          totalUpdated: 2,
          errorMessage: null,
        };
      }
      return null;
    });

    const service = new IntegracoesListService();
    const result = await service.execute();

    expect(result.map((r) => r.key)).toEqual(["a", "b"]);
    expect(result[0].lastRun?.totalReceived).toBe(5);
    expect(result[1].lastRun).toBeNull();
    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });

  it("expõe manualTrigger=false quando o job não é manual", async () => {
    getJobsMock.mockReturnValue([
      { name: "C", key: "c", label: "Cron", schedule: "0 0 * * *" },
    ]);
    findFirstMock.mockResolvedValue(null);

    const service = new IntegracoesListService();
    const [item] = await service.execute();

    expect(item.manualTrigger).toBe(false);
    expect(item.label).toBe("Cron");
  });
});
