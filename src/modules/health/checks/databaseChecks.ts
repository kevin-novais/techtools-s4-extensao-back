/**
 * DTZ-320 - checks de banco. READ-ONLY: um `SELECT 1` em cada conexao, provando que
 * a instancia responde e as credenciais autenticam. O alvo (host:porta) e lido da
 * connection string para a equipe de rede, sem expor usuario/senha.
 */
import DatabaseManager from '@/database/DatabaseManager';
import { HealthCheck } from '@/modules/health/types/health.types';
import { hostPortFromSqlServerUrl } from '@/modules/health/util/target';

async function selectOne(client: { $queryRawUnsafe: (sql: string) => Promise<unknown> }): Promise<void> {
    await client.$queryRawUnsafe('SELECT 1');
}

export const databaseChecks: HealthCheck[] = [
    {
        name: 'BD - s4-extensao-dotz',
        category: 'database',
        target: () => hostPortFromSqlServerUrl(process.env.DATABASE_URL),
        run: async () => {
            await selectOne(DatabaseManager.getS4DotzClient());
            return { detail: 'SELECT 1 ok' };
        },
    },
    {
        name: 'BD - dotz-stage-troca',
        category: 'database',
        target: () => hostPortFromSqlServerUrl(process.env.DOTZ_STAGE_DATABASE_URL),
        run: async () => {
            await selectOne(DatabaseManager.getDotzStageClient());
            return { detail: 'SELECT 1 ok' };
        },
    },
    {
        name: 'BD - Usuário de report',
        category: 'database',
        target: () => hostPortFromSqlServerUrl(process.env.RELATORIO_READONLY_DATABASE_URL),
        run: async () => {
            await selectOne(DatabaseManager.getRelatorioReadonlyClient());
            return { detail: 'SELECT 1 ok' };
        },
    },
];
