import log from '@/util/logger';

type PrismaClientS4Dotz = any;
type PrismaClientDotzStage = any;
type PrismaClientRelatorioReadonly = any;

const isDevelopment = process.env.NODE_ENV === 'development';
const prismaLogLevels = isDevelopment ? ['error', 'warn'] : ['error'];

// Valores padrão para pool de conexões
const DEFAULT_CONNECTION_LIMIT = 50;
const DEFAULT_POOL_TIMEOUT = 50;

let Config: any = {
  DATABASE_CONNECTION_LIMIT: DEFAULT_CONNECTION_LIMIT,
  DATABASE_POOL_TIMEOUT: DEFAULT_POOL_TIMEOUT,
};

try {
  const configModule = require('@/config/config');
  if (configModule?.Config) {
    Config = configModule.Config;
  }
} catch {
}

class DatabaseManager {
  private static s4DotzInstance: PrismaClientS4Dotz | null = null;
  private static dotzStageInstance: PrismaClientDotzStage | null = null;
  private static relatorioReadonlyInstance: PrismaClientRelatorioReadonly | null = null;

  static getS4DotzClient(): PrismaClientS4Dotz {
    if (!this.s4DotzInstance) {
      try {
        const { PrismaClient } = require('@prisma/client-s4-dotz');

        this.s4DotzInstance = new PrismaClient({
          log: prismaLogLevels,
          // @ts-ignore - Configuração interna do Prisma para pool
          __internal: {
            engine: {
              connection_limit: Config.DATABASE_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT,
              pool_timeout: Config.DATABASE_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT,
            }
          }
        });
      } catch (err) {
        if (!isDevelopment) {
          log.error('S4 Dotz Prisma client initialization failed', { error: err });
        }
        throw new Error('S4 Dotz client not generated. Run: npm run prisma:generate:s4');
      }
    }
    return this.s4DotzInstance;
  }

  static getDotzStageClient(): PrismaClientDotzStage {
    if (!process.env.DOTZ_STAGE_DATABASE_URL) {
      throw new Error('DOTZ_STAGE_DATABASE_URL not configured');
    }

    if (!this.dotzStageInstance) {
      try {
        const { PrismaClient } = require('@prisma/client-dotz-stage');

        this.dotzStageInstance = new PrismaClient({
          log: prismaLogLevels,
          // @ts-ignore - Configuração interna do Prisma para pool
          __internal: {
            engine: {
              connection_limit: Config.DATABASE_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT,
              pool_timeout: Config.DATABASE_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT,
            }
          }
        });
      } catch (err) {
        if (!isDevelopment) {
          log.error('Dotz Stage Prisma client initialization failed', { error: err });
        }
        throw new Error('Dotz Stage client not generated. Run: npm run prisma:generate:stage');
      }
    }
    return this.dotzStageInstance;
  }

  static getRelatorioReadonlyClient(): PrismaClientRelatorioReadonly {
    if (!process.env.RELATORIO_READONLY_DATABASE_URL) {
      throw new Error('RELATORIO_READONLY_DATABASE_URL not configured');
    }

    if (!this.relatorioReadonlyInstance) {
      try {
        const { PrismaClient } = require('@prisma/relatorio-readonly-client');

        this.relatorioReadonlyInstance = new PrismaClient({
          log: prismaLogLevels,
        });
      } catch (err) {
        if (!isDevelopment) {
          log.error('Relatorio Readonly Prisma client initialization failed', { error: err });
        }
        throw new Error('Relatorio Readonly client not generated. Run: npm run prisma:generate:relatorio-readonly');
      }
    }
    return this.relatorioReadonlyInstance;
  }

  static async disconnectAll(): Promise<void> {
    await Promise.all([
      this.s4DotzInstance?.$disconnect(),
      this.dotzStageInstance?.$disconnect(),
      this.relatorioReadonlyInstance?.$disconnect(),
    ].filter(Boolean));

    this.s4DotzInstance = null;
    this.dotzStageInstance = null;
    this.relatorioReadonlyInstance = null;
  }

}
export default DatabaseManager;
