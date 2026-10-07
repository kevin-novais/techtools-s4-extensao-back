// src/cron/IntegrationExecutionRecorder.ts
import { IntegrationRunResult } from "@/cron/IntegrationRunResult";

export type IntegrationTriggerType = "SCHEDULED" | "MANUAL";

export interface IntegrationExecutionStartInput {
  integrationKey: string;
  triggerType: IntegrationTriggerType;
  triggeredBy?: string | null;
}

export interface IntegrationExecutionRecorder {
  start(input: IntegrationExecutionStartInput): Promise<number>;
  finishSuccess(logId: number, counts: IntegrationRunResult): Promise<void>;
  finishError(logId: number, message: string): Promise<void>;
}

export const noopIntegrationExecutionRecorder: IntegrationExecutionRecorder = {
  async start(): Promise<number> {
    return 0;
  },
  async finishSuccess(): Promise<void> {},
  async finishError(): Promise<void> {},
};
