/**
 * DTZ-320 - orquestra os checks: roda todos em paralelo, cada um com timeout proprio,
 * e agrega o resultado. Nunca lanca - uma dependencia fora do ar vira status 'fail' no
 * relatorio, nao um 500. Um unico ponto em falha faz o relatorio inteiro ficar 'fail'.
 */
import os from 'node:os';
import { Config } from '@/config/config';
import { allHealthChecks } from '@/modules/health/checks';
import type {
    HealthCheck,
    HealthCheckResult,
    HealthReport,
} from '@/modules/health/types/health.types';

const DEFAULT_CHECK_TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout após ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

/** Mensagem legível mesmo para erros de rede (ECONNREFUSED, AggregateError sem message). */
function describeError(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }
    const aggregated = (error as { errors?: unknown[] }).errors;
    if ((!error.message || error.message.length === 0) && Array.isArray(aggregated) && aggregated.length) {
        return aggregated
            .map((e) => (e instanceof Error ? e.message || (e as { code?: string }).code : String(e)))
            .filter(Boolean)
            .join('; ');
    }
    const code = (error as { code?: string }).code;
    const message = error.message || '';
    if (code && !message.includes(code)) {
        return message ? `${code}: ${message}` : code;
    }
    return message || String(error);
}

function safeTarget(check: HealthCheck): string {
    try {
        return check.target();
    } catch {
        return '-';
    }
}

async function runOne(check: HealthCheck): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    const target = safeTarget(check);
    const timeoutMs = check.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
    try {
        const { detail } = await withTimeout(check.run(), timeoutMs);
        return {
            name: check.name,
            category: check.category,
            target,
            status: 'ok',
            latencyMs: Date.now() - startedAt,
            detail,
        };
    } catch (error) {
        return {
            name: check.name,
            category: check.category,
            target,
            status: 'fail',
            latencyMs: Date.now() - startedAt,
            detail: describeError(error),
        };
    }
}

export class HealthCheckService {
    constructor(private readonly checks: HealthCheck[] = allHealthChecks) {}

    /** Container que respondeu (api ou consumer), para saber que ambos foram testados. */
    static resolveContainer(): string {
        return process.env.HEALTH_CONTAINER_NAME || process.env.CONTAINER_NAME || os.hostname();
    }

    async run(): Promise<HealthReport> {
        const startedAt = Date.now();
        const checks = await Promise.all(this.checks.map((check) => runOne(check)));

        const ok = checks.filter((c) => c.status === 'ok').length;
        const fail = checks.length - ok;

        return {
            status: fail === 0 ? 'ok' : 'fail',
            mode: Config.HEALTH_CHECK_ONLY ? 'HEALTH_CHECK_ONLY' : 'FULL',
            container: HealthCheckService.resolveContainer(),
            environment: process.env.NODE_ENV || 'unknown',
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            summary: { total: checks.length, ok, fail },
            checks,
        };
    }
}
