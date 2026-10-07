/**
 * DTZ-320 - extrai "host:porta" (sem credencial) de uma URL/connection string, para
 * exibir no relatorio exatamente qual endereco de rede foi testado. Nunca lanca:
 * em erro, devolve um rotulo generico para nao vazar segredo nem quebrar o check.
 */

/** Remove usuario:senha e querystring, devolvendo host:porta (porta default por protocolo). */
export function hostPortFromUrl(raw: string | undefined, fallback = 'nao configurado'): string {
    if (!raw) return fallback;
    try {
        const url = new URL(raw);
        const proto = url.protocol.replace(':', '');
        const defaultPort: Record<string, string> = {
            https: '443',
            http: '80',
            amqp: '5672',
            amqps: '5671',
        };
        const port = url.port || defaultPort[proto] || '';
        return port ? `${url.hostname}:${port}` : url.hostname;
    } catch {
        return fallback;
    }
}

/**
 * host:porta de uma connection string SQL Server no formato usado pelo Prisma:
 * `sqlserver://HOST:PORT;database=...;user=...;password=...`. A porta default do
 * SQL Server e 1433.
 */
export function hostPortFromSqlServerUrl(raw: string | undefined, fallback = 'nao configurado'): string {
    if (!raw) return fallback;
    const semProto = raw.replace(/^sqlserver:\/\//i, '');
    const authority = semProto.split(';')[0].trim();
    if (!authority) return fallback;
    const [host, port] = authority.split(':');
    if (!host) return fallback;
    return `${host}:${port || '1433'}`;
}
