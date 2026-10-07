/**
 * DTZ-320 - Health check de virada produtiva.
 *
 * Contrato dos checks: cada dependencia (banco, fila, integracao) e verificada de
 * forma READ-ONLY - nada e inserido/alterado. O objetivo e provar que a URL / IP /
 * porta esta liberada no ambiente e, quando aplicavel, que a credencial autentica.
 */

export type HealthStatus = 'ok' | 'fail';

export type HealthCategory =
    | 'database'
    | 'messaging'
    | 'integration'
    | 'storage'
    | 'observability';

export interface HealthCheckResult {
    /** Nome legivel do ponto testado (ex.: "BD - s4-extensao-dotz"). */
    name: string;
    category: HealthCategory;
    /** Alvo efetivamente testado - host:porta ou URL - para a equipe de rede. */
    target: string;
    status: HealthStatus;
    /** Tempo de resposta do teste, em ms. */
    latencyMs: number;
    /** Em falha: a causa. Em sucesso: informacao curta opcional. */
    detail?: string;
}

/** Metadados de um check, sem a funcao de execucao. */
export interface HealthCheckMeta {
    name: string;
    category: HealthCategory;
}

/** Um check e um metadado + o alvo + a funcao de execucao. */
export interface HealthCheck extends HealthCheckMeta {
    /**
     * Resolve o alvo (host:porta / URL) de forma sincrona e barata, a partir da
     * config. Separado do run() para que o alvo apareca no relatorio MESMO em falha -
     * a equipe de rede precisa saber qual endereco caiu.
     */
    target: () => string;
    /** Executa o teste read-only. Resolve { detail? } em sucesso ou lanca em falha. */
    run: () => Promise<{ detail?: string }>;
    /** Timeout individual (ms). Default aplicado pelo runner quando ausente. */
    timeoutMs?: number;
}

export interface HealthReport {
    /** 'ok' se todos os checks passaram, 'fail' se algum falhou. */
    status: HealthStatus;
    /** 'HEALTH_CHECK_ONLY' quando a app subiu no modo apenas-validacao. */
    mode: 'HEALTH_CHECK_ONLY' | 'FULL';
    /** Container que respondeu (api ou consumer), p/ saber que ambos foram testados. */
    container: string;
    environment: string;
    generatedAt: string;
    durationMs: number;
    summary: {
        total: number;
        ok: number;
        fail: number;
    };
    checks: HealthCheckResult[];
}
