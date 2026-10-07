import { CronJobDefinition } from "@/cron/CronManager";
import { syncSapPartnersJob } from "@/cron/jobs/syncSapPartnersJob";
import { syncRegistrosContabeisJob } from "@/cron/jobs/syncRegistrosContabeisJob";
import { vexpensesApprovedReportsJob } from "@/cron/jobs/vexpensesApprovedReportsJob";
import { vexpensesPaymentByClearingJob } from "@/cron/jobs/vexpensesPaymentByClearingJob";
import { processVendasPendentesJob } from "@/cron/jobs/processVendasPendentesJob";
import { processVendasIntegracaoAnalyzerJob } from "@/cron/jobs/processVendasIntegracaoAnalyzerJob";
import { enviarVendasEmailJob } from "@/cron/jobs/enviarVendasEmailJob";
import { processVendaRecDiferidaPendentesJob } from "@/cron/jobs/processVendaRecDiferidaPendentesJob";
import { processVendaRecDiferidaReversaoJob } from "@/cron/jobs/processVendaRecDiferidaReversaoJob";
import { detectVendaRecDiferidaReversaoSapJob } from "@/cron/jobs/detectVendaRecDiferidaReversaoSapJob";
import { detectTrocaReversaoSapJob } from "@/cron/jobs/detectTrocaReversaoSapJob";
import { classificacaoFluxoCaixaXtpgJob } from "@/cron/jobs/classificacaoFluxoCaixaXtpgJob";
import { consultarBoletoJob } from "@/cron/jobs/consultarBoletoJob";
import { xtpgEnviarPrevistoJob } from "@/cron/jobs/xtpgEnviarPrevistoJob";
import { xtpgEnviarRealizadoJob } from "@/cron/jobs/xtpgEnviarRealizadoJob";
import { xtpgProcessarSaidaJob } from "@/cron/jobs/xtpgProcessarSaidaJob";

export const cronJobs: CronJobDefinition[] = [
  syncSapPartnersJob,
  syncRegistrosContabeisJob,
  vexpensesApprovedReportsJob,
  vexpensesPaymentByClearingJob,
  processVendasPendentesJob,
  processVendasIntegracaoAnalyzerJob,
  consultarBoletoJob,
  enviarVendasEmailJob,
  processVendaRecDiferidaPendentesJob,
  processVendaRecDiferidaReversaoJob,
  detectVendaRecDiferidaReversaoSapJob,
  detectTrocaReversaoSapJob,
  classificacaoFluxoCaixaXtpgJob,
  xtpgEnviarPrevistoJob,
  xtpgEnviarRealizadoJob,
  xtpgProcessarSaidaJob,
];

export { syncSapPartnersJob } from "@/cron/jobs/syncSapPartnersJob";
export { syncRegistrosContabeisJob } from "@/cron/jobs/syncRegistrosContabeisJob";
export { vexpensesApprovedReportsJob } from "@/cron/jobs/vexpensesApprovedReportsJob";
export { vexpensesPaymentByClearingJob } from "@/cron/jobs/vexpensesPaymentByClearingJob";
export { processVendasPendentesJob } from "@/cron/jobs/processVendasPendentesJob";
export { processVendasIntegracaoAnalyzerJob } from "@/cron/jobs/processVendasIntegracaoAnalyzerJob";
export { enviarVendasEmailJob } from "@/cron/jobs/enviarVendasEmailJob";
export { processVendaRecDiferidaPendentesJob } from "@/cron/jobs/processVendaRecDiferidaPendentesJob";
export { processVendaRecDiferidaReversaoJob } from "@/cron/jobs/processVendaRecDiferidaReversaoJob";
export { detectVendaRecDiferidaReversaoSapJob } from "@/cron/jobs/detectVendaRecDiferidaReversaoSapJob";
export { detectTrocaReversaoSapJob } from "@/cron/jobs/detectTrocaReversaoSapJob";
export { classificacaoFluxoCaixaXtpgJob } from "@/cron/jobs/classificacaoFluxoCaixaXtpgJob";
export { consultarBoletoJob } from "@/cron/jobs/consultarBoletoJob";
export { xtpgEnviarPrevistoJob } from "@/cron/jobs/xtpgEnviarPrevistoJob";
export { xtpgEnviarRealizadoJob } from "@/cron/jobs/xtpgEnviarRealizadoJob";
export { xtpgProcessarSaidaJob } from "@/cron/jobs/xtpgProcessarSaidaJob";
