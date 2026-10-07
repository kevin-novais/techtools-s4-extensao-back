import apm from "@/apm";
import { Config } from '@/config/config';
import { rabbitmqConnection } from '@/queue/config/rabbitmq';
import { startAllConsumers } from '@/queue/consumers';
import { createHealthApp } from '@/modules/health/healthApp';
import log from '@/util/logger';
import dotenv from 'dotenv';

dotenv.config();

process.env.HEALTH_CONTAINER_NAME = process.env.HEALTH_CONTAINER_NAME || 'consumer';

// DTZ-320: o container consumer não expunha HTTP. Sobe um servidor mínimo só com as
// rotas de health, para o health check existir também neste container.
function startHealthServer() {
    createHealthApp().listen(Config.HEALTH_CHECK_PORT, () => {
        log.info(`Health check (consumer) na porta ${Config.HEALTH_CHECK_PORT}`);
    });
}

async function startWorkers() {
    const transaction = apm.startTransaction("Start Workers", "worker");
    let failed = false;

    try {
        log.info('Iniciando workers...');

        startHealthServer();

        // DTZ-320: no modo HEALTH_CHECK_ONLY o consumer NÃO conecta nem consome as
        // filas - senão roubaria mensagens dos sistemas produtivos ligados. A
        // conectividade do RabbitMQ é validada de forma efêmera pelo próprio /health.
        if (Config.HEALTH_CHECK_ONLY) {
            log.warn('[HEALTH_CHECK_ONLY] Consumidores DESABILITADOS - modo apenas validação de acessos');
            transaction?.setOutcome("success");
            apm.captureError(new Error('[INFO] Consumer em HEALTH_CHECK_ONLY (sem consumir filas).'));
            return;
        }

        // Conecta ao RabbitMQ
        const startRabbitSpan = apm.startSpan("Iniciar Conexão com RabbitMQ");
        try {
            await rabbitmqConnection.connect();
        } catch (error) {
            startRabbitSpan?.setOutcome("failure");
            throw error;
        } finally {
            startRabbitSpan?.end();
        }

        // Inicia os consumidores
        const startConsumerSpan = apm.startSpan("Iniciar Consumidores do RabbitMQ");
        try {
            await startAllConsumers();
        } catch (error) {
            startConsumerSpan?.setOutcome("failure");
            throw error;
        } finally {
            startConsumerSpan?.end();
        }

        transaction?.setOutcome("success");
        log.info('Workers iniciados com sucesso');
        apm.captureError(new Error('[INFO] Workers iniciados.'));
    } catch (err) {
        failed = true;
        const error = err instanceof Error ? err : new Error(String(err));
        log.error("Erro ao iniciar workers: %o", error);
        transaction?.setOutcome("failure");
        apm.captureError(error);
    } finally {
        transaction?.end();
        if (failed) {
            try {
                await apm.flush();
            } finally {
                process.exit(1);
            }
        }
    } 
}

// Graceful shutdown
process.on('SIGINT', async () => {
    log.info('Recebido SIGINT. Encerrando workers...');

    try {
        await rabbitmqConnection.disconnect();
        log.info('Workers encerrados com sucesso');
        process.exit(0);
    } catch (error) {
        log.error('Erro ao encerrar workers: %o', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    log.info('Recebido SIGTERM. Encerrando workers...');

    try {
        await rabbitmqConnection.disconnect();
        log.info('Workers encerrados com sucesso');
        process.exit(0);
    } catch (error) {
        log.error('Erro ao encerrar workers: %o', error);
        process.exit(1);
    }
});

// Inicia os workers
startWorkers();
