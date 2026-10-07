import { type Channel, type ConsumeMessage } from 'amqplib';
import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { VendasIntegrationQueueMessage, VendasIntegrationQueueType } from '@/queue/types/vendasIntegrationQueue.types';
import { Config } from '@/config/config';
import log from '@/util/logger';
import AppError from '@/util/AppError';
import s4DotzClient from '@/database/clients/s4DotzClient';
import { StatusVendas } from '@/@types/VendasHeader/StatusVendasTypes';
import { VendasIntegrationOrchestratorService } from '@/modules/vendas/utils/integracao/VendasIntegrationOrchestratorService';
import { extractSapIntegrationAxiosError } from '@/modules/documento-fiscal/utils/integracao/extractSapIntegrationAxiosError';
import apm from '@/apm';

const MAX_RETRIES = 2;
const orchestrator = new VendasIntegrationOrchestratorService();

async function processVendasIntegrationMessage(message: VendasIntegrationQueueMessage): Promise<void> {
    if (message.type !== VendasIntegrationQueueType.INTEGRAR_VENDAS) {
        log.warn(`Tipo de mensagem desconhecido: ${(message as any).type}`);
        throw new Error(`Tipo de mensagem desconhecido`);
    }

    const { vendasHeaderId } = message.data;

    log.info(`[VendasIntegrationConsumer] Iniciando integração SAP para venda ${vendasHeaderId}`);

    const resultado = await orchestrator.integrate({
        vendasHeaderId,
        failFast: true,
        updateStatus: true,
    });

    if (resultado.status === "ignorado") {
        log.warn(`[VendasIntegrationConsumer] Venda ${vendasHeaderId} já estava integrada. Ignorando mensagem.`);
    }
}

async function updateVendaStatusErroProcessamento(msg: ConsumeMessage, msgError:string): Promise<void> {
    try {
        const vendasMessage = JSON.parse(msg.content.toString()) as VendasIntegrationQueueMessage;
        const vendasHeaderId = vendasMessage.data?.vendasHeaderId;

        if (!vendasHeaderId) {
            log.warn('[VendasIntegrationConsumer] Não foi possível identificar vendasHeaderId para marcar ERRO_PROC');
            return;
        }

        // retornoIntegracaoSap não é sobrescrito aqui: o VendasIntegrationRunner já persiste
        // o request/response estruturados (inclusive para falhas na montagem do payload)
        // antes de propagar o erro até este consumer.
        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                status: StatusVendas.ERRO_PROC,
                atualizadoEm: new Date(),
            },
        });

        log.info(`[VendasIntegrationConsumer] Status da venda ${vendasHeaderId} atualizado para ERRO_PROC: ${msgError}`);
    } catch (updateError) {
        log.error('[VendasIntegrationConsumer] Erro ao atualizar status para ERRO_PROC: %o', updateError);
    }
}

async function run(channel: Channel, msg: ConsumeMessage): Promise<void> {
    try {
        const messageContent = msg.content.toString();
        const vendasMessage: VendasIntegrationQueueMessage = JSON.parse(messageContent);

        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

        log.info(
            `Processando integração de vendas do tipo: ${vendasMessage.type} (tentativa ${retryCount + 1}/${MAX_RETRIES})`,
        );

        await processVendasIntegrationMessage(vendasMessage);

        channel.ack(msg);
    } catch (error) {
        // Erros de negócio (AppError) não devem ser retriados
        if (error instanceof AppError) {
            const msgError = `Erro de negócio ao processar integração de vendas: ${error.message}`;
            log.error(msgError);
            await updateVendaStatusErroProcessamento(msg, msgError);
            channel.ack(msg);
            throw error;
        }

        // Erros técnicos podem ser retriados
        const extracted = extractSapIntegrationAxiosError(error);
        log.error(
            `Erro ao processar mensagem da fila de integração de vendas: ${extracted.mensagem} (status ${extracted.httpStatus})`,
            { statusCode: extracted.httpStatus, corpoRespostaSap: extracted.corpo },
        );

        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

        if (retryCount < MAX_RETRIES - 1) {
            log.warn(`Reenviando mensagem para retry (tentativa ${retryCount + 2}/${MAX_RETRIES})`);

            channel.sendToQueue(QUEUES.VENDAS_INTEGRATION, msg.content, {
                persistent: true,
                headers: {
                    'x-retry-count': retryCount + 1,
                },
            });

            channel.ack(msg);
        } else {
            log.error(`Mensagem falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`);

            // Atualiza status para ERRO_INTEGRACAO quando esgotou todos os retries
            try {
                const vendasMessage = JSON.parse(msg.content.toString()) as VendasIntegrationQueueMessage;
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasMessage.data.vendasHeaderId },
                    data: {
                        status: StatusVendas.ERRO_INTEG_SAP,
                        dataIntegracao: new Date(),
                        atualizadoEm: new Date(),
                    },
                });
                log.info(`[VendasIntegrationConsumer] Status da venda ${vendasMessage.data.vendasHeaderId} atualizado para ERRO_INTEGRACAO após ${MAX_RETRIES} tentativas`);
            } catch (updateError) {
                log.error('Erro ao atualizar status para ERRO_INTEGRACAO: %o', updateError);
            }

            channel.nack(msg, false, false);
        }

        throw error;
    }
}

export async function startVendasIntegrationConsumer(): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        await channel.prefetch(Config.RABBITMQ_PREFETCH_VENDAS);

        log.info(
            `Consumidor de integração de vendas iniciado (prefetch: ${Config.RABBITMQ_PREFETCH_VENDAS}). Aguardando mensagens na fila: ${QUEUES.VENDAS_INTEGRATION}`,
        );

        await channel.consume(
            QUEUES.VENDAS_INTEGRATION,
            async (msg: ConsumeMessage | null) => {
                if (!msg) {
                    return;
                }

                try {
                    await run(channel, msg);
                } catch(error) {
                    // Registrar falha no APM
                    apm.captureError(error instanceof Error ? error : new Error(String(error)));
                }
            },
            {
                noAck: false,
            },
        );
    } catch (error) {
        log.error('Erro ao iniciar consumidor de integração de vendas: %o', error);
        throw error;
    }
}
