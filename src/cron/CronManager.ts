// src/cron/CronManager.ts
import { parseExpression } from "cron-parser";
import log from "@/util/logger";
import { BRAZIL_TIMEZONE } from "@/util/date";
import { IntegrationRunResult } from "@/cron/IntegrationRunResult";
import {
  IntegrationExecutionRecorder,
  IntegrationTriggerType,
  noopIntegrationExecutionRecorder,
} from "@/cron/IntegrationExecutionRecorder";

export type CronJobHandler = () => Promise<IntegrationRunResult | void> | IntegrationRunResult | void;

export interface CronJobDefinition {
  name: string;
  schedule: string;
  task: CronJobHandler;
  key?: string;
  label?: string;
  manualTrigger?: boolean;
  timezone?: string;
  runOnInit?: boolean;
  enabled?: boolean;
}

export type TriggerJobResult =
  | { started: true; logId: number }
  | { started: false; reason: "running" | "unknown" | "not_manual" };

interface JobState {
  timeout: NodeJS.Timeout | null;
  periodMs: number;
}

export class CronManager {
  private readonly jobs = new Map<string, CronJobDefinition>();
  private readonly states = new Map<string, JobState>();
  private readonly running = new Set<string>();
  private started = false;

  constructor(
    private readonly recorder: IntegrationExecutionRecorder = noopIntegrationExecutionRecorder,
  ) {}

  registerJob(job: CronJobDefinition): void {
    if (!job) throw new Error("Cron job definition is required");
    if (!job.name?.trim()) throw new Error("Cron job name is required");

    if (job.enabled === false) {
      log.info(`Cron job '${job.name}' desabilitado via configuração`);
      return;
    }
    if (!job.schedule?.trim()) throw new Error(`Cron job '${job.name}' schedule is required`);
    if (!job.task) throw new Error(`Cron job '${job.name}' task is required`);

    const periodMs = this.computePeriodMs(job);
    if (periodMs === null) {
      throw new Error(`Cron job '${job.name}' has an invalid schedule expression: ${job.schedule}`);
    }
    if (this.jobs.has(job.name)) {
      log.warn(`Cron job '${job.name}' já está registrado`);
      return;
    }

    this.jobs.set(job.name, job);
    this.states.set(job.name, { timeout: null, periodMs });
    log.info(`Cron job '${job.name}' registrado`);

    if (this.started) this.startJob(job.name);
  }

  startAll(): void {
    if (!this.jobs.size) {
      log.warn("Nenhum cron job registrado para iniciar");
      return;
    }
    if (this.started) {
      log.warn("CronManager já foi iniciado");
      return;
    }
    this.jobs.forEach((_, name) => this.startJob(name));
    this.started = true;
    log.info(`CronManager iniciado com ${this.states.size} job(s) ativo(s)`);
  }

  startJob(name: string): void {
    const job = this.jobs.get(name);
    const state = this.states.get(name);
    if (!job || !state) {
      log.warn(`Cron job '${name}' não encontrado`);
      return;
    }
    this.scheduleNext(name, this.msUntilNextOccurrence(job));
    log.info(`Cron job '${name}' agendado (${job.schedule})`);

    if (job.runOnInit) {
      void this.executeJob(job, "SCHEDULED", null);
    }
  }

  stopJob(name: string): void {
    const state = this.states.get(name);
    if (!state || !state.timeout) {
      log.warn(`Cron job '${name}' não está em execução`);
      return;
    }
    clearTimeout(state.timeout);
    state.timeout = null;
    log.info(`Cron job '${name}' interrompido`);
  }

  stopAll(): void {
    this.states.forEach((state) => {
      if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
      }
    });
    this.started = false;
    log.info("CronManager interrompido");
  }

  isStarted(): boolean {
    return this.started;
  }

  getActiveJobs(): string[] {
    return Array.from(this.states.entries())
      .filter(([, s]) => s.timeout !== null)
      .map(([name]) => name);
  }

  getJobs(): CronJobDefinition[] {
    return Array.from(this.jobs.values());
  }

  findByKey(key: string): CronJobDefinition | undefined {
    return Array.from(this.jobs.values()).find((j) => j.key === key);
  }

  async triggerJob(
    nameOrKey: string,
    opts: { triggeredBy?: string | null } = {},
  ): Promise<TriggerJobResult> {
    const job = this.jobs.get(nameOrKey) ?? this.findByKey(nameOrKey);
    if (!job) return { started: false, reason: "unknown" };
    if (job.manualTrigger !== true) return { started: false, reason: "not_manual" };
    if (this.running.has(job.name)) return { started: false, reason: "running" };

    const logId = await this.executeJob(job, "MANUAL", opts.triggeredBy ?? null);
    return { started: true, logId };
  }

  private scheduleNext(name: string, delayMs: number): void {
    const state = this.states.get(name);
    const job = this.jobs.get(name);
    if (!state || !job) return;
    if (state.timeout) clearTimeout(state.timeout);
    const safeDelay = Math.max(0, delayMs);
    state.timeout = setTimeout(() => {
      void this.executeJob(job, "SCHEDULED", null);
    }, safeDelay);
  }

  private async executeJob(
    job: CronJobDefinition,
    triggerType: IntegrationTriggerType,
    triggeredBy: string | null,
  ): Promise<number> {
    if (this.running.has(job.name)) {
      log.warn(`Cron job '${job.name}' já em execução; disparo ${triggerType} ignorado`);
      return 0;
    }
    this.running.add(job.name);
    const triggeredAt = Date.now();

    let logId = 0;
    try {
      logId = await this.recorder.start({
        integrationKey: job.key ?? job.name,
        triggerType,
        triggeredBy,
      });
    } catch (e) {
      log.error(`Falha ao registrar início do log '${job.name}': ${e instanceof Error ? e.message : String(e)}`);
    }

    void this.runAndFinalize(job, triggerType, triggeredAt, logId);
    return logId;
  }

  private async runAndFinalize(
    job: CronJobDefinition,
    triggerType: IntegrationTriggerType,
    triggeredAt: number,
    logId: number,
  ): Promise<void> {
    try {
      log.info(`Cron job '${job.name}' iniciado (${triggerType})`);
      const result = (await job.task()) || {};
      await this.safeFinishSuccess(logId, result);
      log.info(`Cron job '${job.name}' finalizado`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Cron job '${job.name}' falhou: ${message}`);
      await this.safeFinishError(logId, message);
    } finally {
      this.running.delete(job.name);
      this.rescheduleAfterRun(job, triggerType, triggeredAt);
    }
  }

  private rescheduleAfterRun(
    job: CronJobDefinition,
    triggerType: IntegrationTriggerType,
    triggeredAt: number,
  ): void {
    const state = this.states.get(job.name);
    if (!state || !this.started) return;
    if (triggerType === "MANUAL") {
      const elapsed = Date.now() - triggeredAt;
      this.scheduleNext(job.name, state.periodMs - elapsed);
    } else {
      this.scheduleNext(job.name, this.msUntilNextOccurrence(job));
    }
  }

  private async safeFinishSuccess(logId: number, counts: IntegrationRunResult): Promise<void> {
    try {
      await this.recorder.finishSuccess(logId, counts);
    } catch (e) {
      log.error(`Falha ao registrar sucesso do log ${logId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async safeFinishError(logId: number, message: string): Promise<void> {
    try {
      await this.recorder.finishError(logId, message);
    } catch (e) {
      log.error(`Falha ao registrar erro do log ${logId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private msUntilNextOccurrence(job: CronJobDefinition): number {
    const tz = job.timezone ?? BRAZIL_TIMEZONE;
    const it = parseExpression(job.schedule, { tz, currentDate: new Date() });
    return it.next().toDate().getTime() - Date.now();
  }

  private computePeriodMs(job: CronJobDefinition): number | null {
    try {
      const tz = job.timezone ?? BRAZIL_TIMEZONE;
      const it = parseExpression(job.schedule, { tz, currentDate: new Date() });
      const a = it.next().toDate().getTime();
      const b = it.next().toDate().getTime();
      return b - a;
    } catch {
      return null;
    }
  }
}
