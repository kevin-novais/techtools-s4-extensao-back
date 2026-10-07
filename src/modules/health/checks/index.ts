/**
 * DTZ-320 - registro unico de todos os checks de conectividade, na ordem em que
 * aparecem no relatorio. A ordem espelha a lista do chamado (bancos -> fila ->
 * integracoes -> storage -> observabilidade).
 */
import { HealthCheck } from '@/modules/health/types/health.types';
import { databaseChecks } from '@/modules/health/checks/databaseChecks';
import { messagingChecks } from '@/modules/health/checks/messagingChecks';
import { integrationChecks } from '@/modules/health/checks/integrationChecks';
import { storageChecks } from '@/modules/health/checks/storageChecks';
import { observabilityChecks } from '@/modules/health/checks/observabilityChecks';

export const allHealthChecks: HealthCheck[] = [
    ...databaseChecks,
    ...messagingChecks,
    ...integrationChecks,
    ...storageChecks,
    ...observabilityChecks,
];
