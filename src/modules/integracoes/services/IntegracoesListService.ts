// src/modules/integracoes/services/IntegracoesListService.ts
import { cronManager } from "@/cron";
import s4DotzClient from "@/database/clients/s4DotzClient";

export interface IntegracaoListItem {
  key: string;
  label: string;
  schedule: string;
  manualTrigger: boolean;
  lastRun: {
    status: string;
    triggerType: string;
    startedAt: Date;
    finishedAt: Date | null;
    totalReceived: number | null;
    totalUpdated: number | null;
    errorMessage: string | null;
  } | null;
}

export class IntegracoesListService {
  async execute(): Promise<IntegracaoListItem[]> {
    // N+1 proposital: ~10 jobs fixos numa tela admin; uma query por job para a última execução.
    const jobs = cronManager.getJobs().filter((j) => j.key);

    const items = await Promise.all(
      jobs.map(async (job) => {
        const last = await s4DotzClient.integrationExecutionLog.findFirst({
          where: { integrationKey: job.key as string },
          orderBy: { startedAt: "desc" },
          select: {
            status: true,
            triggerType: true,
            startedAt: true,
            finishedAt: true,
            totalReceived: true,
            totalUpdated: true,
            errorMessage: true,
          },
        });
        return {
          key: job.key as string,
          label: job.label ?? job.name,
          schedule: job.schedule,
          manualTrigger: job.manualTrigger === true,
          lastRun: last ?? null,
        } satisfies IntegracaoListItem;
      }),
    );

    return items.sort((a, b) => a.label.localeCompare(b.label));
  }
}
