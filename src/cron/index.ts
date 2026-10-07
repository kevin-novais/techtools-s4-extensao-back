import log from "@/util/logger";
import { CronManager } from "@/cron/CronManager";
import { cronJobs } from "@/cron/jobs";
import { PrismaIntegrationExecutionRecorder } from "@/modules/integracoes/recorders/PrismaIntegrationExecutionRecorder";
import apm from "@/apm";

const cronManager = new CronManager(new PrismaIntegrationExecutionRecorder());

cronJobs.forEach((job) => cronManager.registerJob(job));

export function startCronJobs(): void {
  try {
    cronManager.startAll();
  } catch (error:any) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Falha ao iniciar cron jobs: ${message}`);
    
    const capturedError = error instanceof Error ? error : new Error(String(error));
    apm.captureError(capturedError, {
      message: `[CRON] Falha ao iniciar cron jobs: ${capturedError.message}`,
      custom: {
        cause: capturedError.cause instanceof Error ? capturedError.cause.stack : capturedError.cause,
      },
    });
  }
}

export function stopCronJobs(): void {
  try {
    cronManager.stopAll();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Falha ao parar cron jobs: ${message}`);
  }
}

export { cronManager };

