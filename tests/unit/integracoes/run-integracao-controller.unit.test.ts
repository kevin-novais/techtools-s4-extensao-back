import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { triggerJobMock } = vi.hoisted(() => ({ triggerJobMock: vi.fn() }));

vi.mock("@/cron", () => ({ cronManager: { triggerJob: triggerJobMock } }));

import { RunIntegracaoController } from "@/modules/integracoes/controllers/RunIntegracaoController";

function createMockRes() {
  const captured: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      captured.body = payload;
      return res;
    },
  };
  return { res: res as unknown as Response, captured };
}

async function run(key: string) {
  const controller = new RunIntegracaoController();
  const req = { params: { key }, user: { email: "tester@x.com" } } as unknown as Request;
  const { res, captured } = createMockRes();
  await controller.handle(req, res);
  return captured;
}

describe("RunIntegracaoController", () => {
  beforeEach(() => triggerJobMock.mockReset());

  it("202 com logId quando iniciado, repassando triggeredBy", async () => {
    triggerJobMock.mockResolvedValue({ started: true, logId: 9 });
    const captured = await run("sync_sap_partners");
    expect(captured.statusCode).toBe(202);
    expect((captured.body as { logId: number }).logId).toBe(9);
    expect(triggerJobMock).toHaveBeenCalledWith("sync_sap_partners", {
      triggeredBy: "tester@x.com",
    });
  });

  it("404 quando integração desconhecida", async () => {
    triggerJobMock.mockResolvedValue({ started: false, reason: "unknown" });
    const captured = await run("inexistente");
    expect(captured.statusCode).toBe(404);
  });

  it("403 quando não permite execução manual", async () => {
    triggerJobMock.mockResolvedValue({ started: false, reason: "not_manual" });
    const captured = await run("algum_job");
    expect(captured.statusCode).toBe(403);
  });

  it("409 quando já está em execução", async () => {
    triggerJobMock.mockResolvedValue({ started: false, reason: "running" });
    const captured = await run("algum_job");
    expect(captured.statusCode).toBe(409);
  });
});
