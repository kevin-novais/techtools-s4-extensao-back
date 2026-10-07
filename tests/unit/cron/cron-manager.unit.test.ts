// tests/unit/cron/cron-manager.unit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CronManager } from "@/cron/CronManager";
import type { IntegrationExecutionRecorder } from "@/cron/IntegrationExecutionRecorder";

function makeRecorder() {
  const calls: string[] = [];
  let nextId = 1;
  const rec: IntegrationExecutionRecorder = {
    start: vi.fn(async () => nextId++),
    finishSuccess: vi.fn(async () => { calls.push("success"); }),
    finishError: vi.fn(async () => { calls.push("error"); }),
  };
  return { rec, calls };
}

describe("CronManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixa o relógio no meio de uma janela de 15 min (longe de qualquer marca
    // :00/:15/:30/:45). Sem isso, os testes dependem da hora real do momento em que
    // rodam: se o CI executar perto de uma marca de 15 min, o reagendamento pós-trigger
    // manual pode cair perto o suficiente da próxima marca natural do cron a ponto de
    // gerar um disparo extra dentro da janela testada (ver CronManager.scheduleNext,
    // que sempre reporta o disparo como "SCHEDULED" e recalcula contra a marca natural).
    vi.setSystemTime(new Date("2026-01-05T14:07:30.000-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("agenda o proximo disparo pela proxima ocorrencia da expressao", () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => {});
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task });
    manager.startAll();
    expect(manager.getActiveJobs()).toContain("J");
    manager.stopAll();
  });

  it("triggerJob executa o handler na hora e registra log RUNNING->SUCCESS", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => ({ totalReceived: 3, totalUpdated: 2 }));
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task, manualTrigger: true });
    manager.startAll();

    const result = await manager.triggerJob("J", { triggeredBy: "tester" });
    await vi.advanceTimersByTimeAsync(0);

    expect(result.started).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
    expect(rec.start).toHaveBeenCalledWith(
      expect.objectContaining({ integrationKey: "j", triggerType: "MANUAL", triggeredBy: "tester" }),
    );
    expect(rec.finishSuccess).toHaveBeenCalledWith(expect.any(Number), { totalReceived: 3, totalUpdated: 2 });
    manager.stopAll();
  });

  it("guard: recusa trigger se ja estiver em execucao", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    let resolveTask: () => void = () => {};
    const task = vi.fn(() => new Promise<void>((r) => { resolveTask = r; }));
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task, manualTrigger: true });
    manager.startAll();

    const first = await manager.triggerJob("J");
    const second = await manager.triggerJob("J");
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.reason).toBe("running");
    resolveTask();
    await vi.advanceTimersByTimeAsync(0);
    manager.stopAll();
  });

  it("triggerJob desconhecido retorna unknown", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const result = await manager.triggerJob("NAO_EXISTE");
    expect(result.started).toBe(false);
    expect(result.reason).toBe("unknown");
  });

  it("apos trigger manual, reagenda para agora + periodo (15 min)", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => {});
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task, manualTrigger: true });
    manager.startAll();

    await manager.triggerJob("J");
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(task).toHaveBeenCalledTimes(2);
    manager.stopAll();
  });

  it("triggerJob de job sem manualTrigger retorna not_manual", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => {});
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task });
    manager.startAll();

    const result = await manager.triggerJob("J");
    expect(result.started).toBe(false);
    expect(result.started === false && result.reason).toBe("not_manual");
    expect(task).not.toHaveBeenCalled();
    manager.stopAll();
  });

  it("falha do recorder.start nao impede a execucao do job", async () => {
    const rec: IntegrationExecutionRecorder = {
      start: vi.fn(async () => { throw new Error("db down"); }),
      finishSuccess: vi.fn(async () => {}),
      finishError: vi.fn(async () => {}),
    };
    const manager = new CronManager(rec);
    const task = vi.fn(async () => ({ totalReceived: 1 }));
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task, manualTrigger: true });
    manager.startAll();

    const result = await manager.triggerJob("J");
    await vi.advanceTimersByTimeAsync(0);

    expect(result.started).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
    expect(rec.finishSuccess).toHaveBeenCalled();
    manager.stopAll();
  });

  it("job que lanca erro registra finishError e libera o guard (pode disparar de novo)", async () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => { throw new Error("boom"); });
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task, manualTrigger: true });
    manager.startAll();

    await manager.triggerJob("J");
    await vi.advanceTimersByTimeAsync(0);
    expect(rec.finishError).toHaveBeenCalledWith(expect.any(Number), "boom");

    const second = await manager.triggerJob("J");
    await vi.advanceTimersByTimeAsync(0);
    expect(second.started).toBe(true);
    expect(task).toHaveBeenCalledTimes(2);
    manager.stopAll();
  });

  it("stopAll limpa os timers e zera os jobs ativos", () => {
    const { rec } = makeRecorder();
    const manager = new CronManager(rec);
    const task = vi.fn(async () => {});
    manager.registerJob({ name: "J", key: "j", schedule: "*/15 * * * *", task });
    manager.startAll();
    expect(manager.getActiveJobs()).toContain("J");

    manager.stopAll();
    expect(manager.getActiveJobs()).toHaveLength(0);
  });
});
