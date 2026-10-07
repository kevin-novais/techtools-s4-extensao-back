import { type ConsumeMessage } from 'amqplib';
import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { DocumentoFiscalQueueMessage, DocumentoFiscalQueueType } from '@/queue/types/documentoFiscalQueue.types';
import { ProcessRomaneioDetalheService } from '@/modules/documento-fiscal/documento-details/romaneio/services/ProcessRomaneioDetalheService';
import { ProcessDocumentoFiscalPosDetalheService } from '@/modules/documento-fiscal/documento-details/pos/services/ProcessPosService';
import { Config } from '@/config/config';
import log from '@/util/logger';
import AppError from '@/util/AppError';
import apm from '@/apm';

const MAX_RETRIES = 3;

async function processDocumentoFiscalMessage(message: DocumentoFiscalQueueMessage): Promise<void> {
    if (message.type === DocumentoFiscalQueueType.PROCESSAR_DETALHES) {
        const service = new ProcessRomaneioDetalheService();
        await service.execute(message.data.documentoFiscalHeaderId);
        log.info(`Processamento de detalhes concluído para documento ${message.data.documentoFiscalHeaderId}`);
        return;
    }

    if (message.type === DocumentoFiscalQueueType.PROCESSAR_DETALHES_POS) {
        const service = new ProcessDocumentoFiscalPosDetalheService();
        await service.execute({
            documentoFiscalHeaderId: message.data.documentoFiscalHeaderId,
            filtros: message.data.filtros,
            fornecedorCardCode: message.data.fornecedorCardCode,
        });
        log.info(`Processamento de detalhes POS concluído para documento ${message.data.documentoFiscalHeaderId}${message.data.fornecedorCardCode ? ` - fornecedor ${message.data.fornecedorCardCode}` : ' - todos os fornecedores do grupo'}`);
        return;
    }

    log.warn(`Tipo de mensagem desconhecido: ${(message as any).type}`);
    throw new Error(`Tipo de mensagem desconhecido`);
}

export async function startDocumentoFiscalConsumer(): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        await channel.prefetch(Config.RABBITMQ_PREFETCH_DOCUMENTO);

        log.info(`Consumidor de documento fiscal iniciado (prefetch: ${Config.RABBITMQ_PREFETCH_DOCUMENTO}). Aguardando mensagens na fila: ${QUEUES.DOCUMENTO_FISCAL}`);

        await channel.consume(
            QUEUES.DOCUMENTO_FISCAL,
            async (msg: ConsumeMessage | null) => {
                if (!msg) {
                    return;
                }

                try {
                    const messageContent = msg.content.toString();
                    const documentoFiscalMessage: DocumentoFiscalQueueMessage = JSON.parse(messageContent);

                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

                    log.info(`Processando documento fiscal do tipo: ${documentoFiscalMessage.type} (tentativa ${retryCount + 1}/${MAX_RETRIES})`);

                    await processDocumentoFiscalMessage(documentoFiscalMessage);

                    channel.ack(msg);
                } catch (error) {
                    const documentoFiscalConsumerError = error instanceof Error ? error : new Error(String(error));
                    try {
                        // Registrar falha no APM
                        apm.captureError(documentoFiscalConsumerError);

                        // Erros de negócio (AppError) não devem ser retriados
                        if (error instanceof AppError) {
                            log.error(`Erro de negócio ao processar documento fiscal: ${error.message}`);
                            log.warn('Mensagem descartada (erro de negócio, sem retry)');
                            channel.ack(msg);
                            return;
                        }

                        // Erros técnicos podem ser retriados
                        log.error('Erro ao processar mensagem da fila de documento fiscal: %o', error);
                        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

                        if (retryCount < MAX_RETRIES - 1) {
                            log.warn(`Reenviando mensagem para retry (tentativa ${retryCount + 2}/${MAX_RETRIES})`);
                            
                            channel.sendToQueue(QUEUES.DOCUMENTO_FISCAL, msg.content, {
                                persistent: true,
                                headers: {
                                    'x-retry-count': retryCount + 1,
                                },
                            });
                            channel.ack(msg);
                        } else {
                            log.error(`Mensagem falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`);
                            channel.nack(msg, false, false);
                        }
                    } catch (apmError) {
                        log.error('Erro ao registrar falha no APM: %o', apmError);
                    }
                }
            },
            {
                noAck: false,
            }
        );
    } catch (error) {
        log.error('Erro ao iniciar consumidor de documento fiscal: %o', error);
        throw error;
    }
}

