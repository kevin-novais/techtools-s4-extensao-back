// src/modules/integracoes/recorders/PrismaIntegrationExecutionRecorder.ts
import s4DotzClient from "@/database/clients/s4DotzClient";
import { IntegrationRunResult } from "@/cron/IntegrationRunResult";
import {
  IntegrationExecutionRecorder,
  IntegrationExecutionStartInput,
} from "@/cron/IntegrationExecutionRecorder";

export class PrismaIntegrationExecutionRecorder implements IntegrationExecutionRecorder {
  async start(input: IntegrationExecutionStartInput): Promise<number> {
    const row = await s4DotzClient.integrationExecutionLog.create({
      data: {
        integrationKey: input.integrationKey,
        triggerType: input.triggerType,
        status: "RUNNING",
        startedAt: new Date(),
        triggeredBy: input.triggeredBy ?? undefined,
      },
      select: { id: true },
    });
    return row.id;
  }

  async finishSuccess(logId: number, counts: IntegrationRunResult): Promise<void> {
    if (!logId) return;
    await s4DotzClient.integrationExecutionLog.update({
      where: { id: logId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        totalReceived: counts.totalReceived ?? null,
        totalInserted: counts.totalInserted ?? null,
        totalUpdated: counts.totalUpdated ?? null,
      },
    });
  }

  async finishError(logId: number, message: string): Promise<void> {
    if (!logId) return;
    await s4DotzClient.integrationExecutionLog.update({
      where: { id: logId },
      data: { status: "ERROR", finishedAt: new Date(), errorMessage: message },
    });
  }
}
