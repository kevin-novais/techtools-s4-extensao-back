import log from '@/util/logger';
import { startEmailConsumer } from '@/queue/consumers/emailConsumer';
import { startDocumentoFiscalConsumer } from '@/queue/consumers/documentoFiscalConsumer';
import { startSapIntegrationConsumer } from '@/queue/consumers/sapIntegrationConsumer';
import { startVexpensesSAPIntegrationConsumer } from '@/queue/consumers/vexpensesSapIntegrationConsumer';
import { startVendasIntegrationConsumer } from '@/queue/consumers/vendasIntegrationConsumer';
import {
    startVendaRecDiferidaConsumer,
    startVendaRecDiferidaReversaoConsumer,
} from '@/queue/consumers/vendaRecDiferidaConsumer';

/**
 * Inicia todos os consumidores de filas
 */
export async function startAllConsumers(): Promise<void> {
    try {
        log.info('Iniciando consumidores de filas...');

        await startEmailConsumer();
        await startDocumentoFiscalConsumer();
        await startSapIntegrationConsumer();
        await startVexpensesSAPIntegrationConsumer();
        await startVendasIntegrationConsumer();
        await startVendaRecDiferidaConsumer();
        await startVendaRecDiferidaReversaoConsumer();

        log.info('Todos os consumidores foram iniciados com sucesso');
    } catch (error) {
        log.error('Erro ao iniciar consumidores: %o', error);
        throw error;
    }
}

