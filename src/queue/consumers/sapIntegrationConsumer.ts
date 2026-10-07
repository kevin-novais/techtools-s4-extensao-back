import { type Channel, type ConsumeMessage } from 'amqplib';
import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { SapIntegrationQueueMessage, SapIntegrationQueueType } from '@/queue/types/sapIntegrationQueue.types';
import { Config } from '@/config/config';
import log from '@/util/logger';
import AppError from '@/util/AppError';
import s4DotzClient from '@/database/clients/s4DotzClient';
import { StatusDocumento } from '@/@types/DocumentoFiscalHeader/StatusDocumentoTypes';
import { IntegrationOrchestratorService } from '@/modules/documento-fiscal/utils/integracao/IntegrationOrchestratorService';
import {
    serializeRetornoIntegracaoSap,
    type RetornoIntegracaoSapPayload,
} from '@/modules/documento-fiscal/utils/integracao/retornoIntegracaoSapJson';
import { extractSapIntegrationAxiosError } from '@/modules/documento-fiscal/utils/integracao/extractSapIntegrationAxiosError';
import apm from '@/apm';

const MAX_RETRIES = 2;
const orchestrator = new IntegrationOrchestratorService();

export async function startSapIntegrationConsumer(): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        await channel.prefetch(Config.RABBITMQ_PREFETCH_SAP);

        log.info(`Consumidor de integração SAP iniciado (prefetch: ${Config.RABBITMQ_PREFETCH_SAP}). Aguardando mensagens na fila: ${QUEUES.SAP_INTEGRATION}`);

        await channel.consume(
            QUEUES.SAP_INTEGRATION,
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
            }
        );
    } catch (error) {
        log.error('Erro ao iniciar consumidor de integração SAP: %o', error);
        throw error;
    }
}

async function run(channel: Channel, msg: ConsumeMessage): Promise<void> {
    try {
        const messageContent = msg.content.toString();
        const sapIntegrationMessage: SapIntegrationQueueMessage = JSON.parse(messageContent);

        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

        log.info(
            `Processando integração SAP do tipo: ${sapIntegrationMessage.type} (tentativa ${retryCount + 1}/${MAX_RETRIES})`
        );

        await processSapIntegrationMessage(sapIntegrationMessage);

        channel.ack(msg);
    } catch (error) {
        // Erros de negócio (AppError) não devem ser retriados
        if (error instanceof AppError) {
            log.error(`Erro de negócio ao processar integração SAP: ${error.message}`);
            log.warn('Mensagem descartada (erro de negócio, sem retry)');
            channel.ack(msg);
            return;
        }

        // Erros técnicos podem ser retriados (mensagem/corpo como no IntegrationRunner, não só axios.message)
        const extracted = extractSapIntegrationAxiosError(error);
        log.error(
            `Erro ao processar mensagem da fila de integração SAP: ${extracted.mensagem} (HTTP ${extracted.httpStatus})`
        );

        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

        if (retryCount < MAX_RETRIES - 1) {
            log.warn(`Reenviando mensagem para retry (tentativa ${retryCount + 2}/${MAX_RETRIES})`);

            channel.sendToQueue(QUEUES.SAP_INTEGRATION, msg.content, {
                persistent: true,
                headers: {
                    'x-retry-count': retryCount + 1,
                },
            });

            channel.ack(msg);
            return;
        }

        log.error(`Mensagem falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`);

        // Só atualiza status para ERRO_INTEG quando esgotou todos os retries
        try {
            const sapMessage = JSON.parse(msg.content.toString()) as SapIntegrationQueueMessage;
            const dlqPayload: RetornoIntegracaoSapPayload = {
                atualizadoEm: new Date().toISOString(),
                origem: 'queue_dlq',
                resultados: [
                    {
                        codigoParceiro: '_',
                        httpStatus: extracted.httpStatus,
                        statusIntegracao: 'erro',
                        mensagem: extracted.mensagem,
                        corpo: extracted.corpo,
                    },
                ],
            };
            await s4DotzClient.documentoFiscalHeader.update({
                where: { id: sapMessage.data.documentoFiscalHeaderId },
                data: {
                    status: StatusDocumento.ERRO_INTEG,
                    dataIntegracao: new Date(),
                    retornoIntegracaoSap: serializeRetornoIntegracaoSap(dlqPayload),
                    atualizadoPor: sapMessage.data.usuarioId,
                    atualizadoEm: new Date(),
                },
            });
            log.info(`[SapIntegrationConsumer] Status do documento ${sapMessage.data.documentoFiscalHeaderId} atualizado para ERRO_INTEG após ${MAX_RETRIES} tentativas`);
        } catch (updateError) {
            log.error('Erro ao atualizar status para ERRO_INTEG: %o', updateError);
        }

        channel.nack(msg, false, false);
    }
}

async function processSapIntegrationMessage(message: SapIntegrationQueueMessage): Promise<void> {
    if (message.type !== SapIntegrationQueueType.INTEGRAR_DOCUMENTO) {
        log.warn(`Tipo de mensagem desconhecido: ${(message as any).type}`);
        throw new Error(`Tipo de mensagem desconhecido`);
    }

    const { documentoFiscalHeaderId, usuarioId } = message.data;

    log.info(`[SapIntegrationConsumer] Iniciando integração SAP para documento ${documentoFiscalHeaderId}`);

    const resultado = await orchestrator.integrate({
        documentoFiscalHeaderId,
        usuarioId,
        origem: "MANUAL", // origem não trafega na mensagem; mantemos para logs
        failFast: true,
        updateStatus: true,
    });

    if (resultado.status === "ignorado") {
        log.warn(`[SapIntegrationConsumer] Documento ${documentoFiscalHeaderId} já estava integrado. Ignorando mensagem.`);
    }
}
