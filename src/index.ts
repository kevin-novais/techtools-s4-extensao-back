import dotenv from 'dotenv';
import log from "@/util/logger";
import apm from './apm';
import { Config } from "@/config/config";
import DatabaseManager from "@/database/DatabaseManager";
import { startCronJobs, stopCronJobs } from "@/cron";
import { createApp } from "@/app";

dotenv.config();

process.env.HEALTH_CONTAINER_NAME = process.env.HEALTH_CONTAINER_NAME || 'api';

export const app = createApp();

const server = app.listen(Config.PORT, () => {

  log.info(`
    API rodando na porta ${Config.PORT} !
    Node environment: ${process.env.NODE_ENV}

    Database connections limit: ${Config.DATABASE_CONNECTION_LIMIT}
    Database pool timeout: ${Config.DATABASE_POOL_TIMEOUT}

    RabbitMQ prefetch: ${Config.RABBITMQ_PREFETCH}
    RabbitMQ prefetch documento: ${Config.RABBITMQ_PREFETCH_DOCUMENTO}
    RabbitMQ prefetch SAP: ${Config.RABBITMQ_PREFETCH_SAP}

  `);

  // DTZ-320: no modo HEALTH_CHECK_ONLY não roda cron - a app não pode concorrer nem
  // afetar os sistemas produtivos ligados; só valida acessos via /health.
  if (Config.HEALTH_CHECK_ONLY) {
    log.warn('[HEALTH_CHECK_ONLY] Cron jobs DESABILITADOS - modo apenas validação de acessos');
  } else {
    startCronJobs();
  }
  apm.captureError(new Error('[INFO] s4-extrensao-dotz-backend iniciado.'));
});

process.on('SIGINT', async () => {
  log.info('Servidor está sendo encerrado...');

  server.close(async () => {
    stopCronJobs();
    await DatabaseManager.disconnectAll();
    log.info('Database connections closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  log.info('Servidor está sendo encerrado...');

  server.close(async () => {
    stopCronJobs();
    await DatabaseManager.disconnectAll();
    log.info('Database connections closed');
    process.exit(0);
  });
});
