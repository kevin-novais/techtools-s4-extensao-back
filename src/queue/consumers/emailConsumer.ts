import apm from '@/apm';
import { Config } from '@/config/config';
import s4DotzClient from '@/database/clients/s4DotzClient';
import { QUEUES, rabbitmqConnection } from '@/queue/config/rabbitmq';
import { EmailQueueMessage, EmailType } from '@/queue/types/emailQueue.types';
import { EmailSendResult } from '@/util/emails/clientEmail';
import { sendForgotPasswordEmail } from '@/util/emails/forgotPasswordEmail';
import { sendFornecedorRelatorioEmail } from '@/util/emails/fornecedorRelatorioEmail';
import { sendVendasRelatorioEmail } from '@/util/emails/vendasRelatorioEmail';
import { sendWelcomeEmail } from '@/util/emails/welcomeEmail';
import log from '@/util/logger';
import { type ConsumeMessage } from 'amqplib';

const MAX_RETRIES = 3;

interface DestinatarioEnvioStatus {
    email: string;
    status: 'ENVIADO' | 'ERRO';
}

async function registrarEnvioVendasEmail(
    vendasHeaderId: number,
    email: string,
    result: EmailSendResult,
): Promise<void> {
    const destinatarios: DestinatarioEnvioStatus[] = [
        ...result.accepted.map((address) => ({ email: address, status: 'ENVIADO' as const })),
        ...result.rejected.map((address) => ({ email: address, status: 'ERRO' as const })),
    ];

    try {
        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                dataEnvioEmail: new Date(),
                destinatarioEmail: email,
                retornoEnvioEmail: JSON.stringify(destinatarios),
            },
        });
    } catch (error) {
        // Nao relanca: o email ja foi enviado, falhar aqui nao pode causar reenvio duplicado.
        log.error(`Erro ao gravar auditoria de envio de email da venda ${vendasHeaderId}: %o`, error);
    }
}

export async function processEmailMessage(message: EmailQueueMessage): Promise<void> {
    switch (message.type) {
        case EmailType.WELCOME:
            await sendWelcomeEmail(message.data);
            log.info(`Email de boas-vindas enviado com sucesso para: ${message.data.email}`);
            break;

        case EmailType.FORGOT_PASSWORD:
            await sendForgotPasswordEmail(message.data);
            log.info(`Email de recuperação de senha enviado com sucesso para: ${message.data.email}`);
            break;

        case EmailType.FORNECEDOR_RELATORIO:
            await sendFornecedorRelatorioEmail(message.data);
            log.info(`Email de relatorio do fornecedor enviado com sucesso para: ${message.data.email}`);
            break;

        case EmailType.VENDAS_RELATORIO: {
            const result = await sendVendasRelatorioEmail(message.data);

            if (result.accepted.length === 0) {
                throw new Error(
                    `Nenhum destinatário aceitou o email de relatorio de vendas (venda=${message.data.vendasHeaderId}): ${result.rejected.join(', ')}`,
                );
            }

            await registrarEnvioVendasEmail(message.data.vendasHeaderId, message.data.email, result);

            if (result.rejected.length > 0) {
                log.warn(
                    `Email de relatorio de vendas enviado com falhas parciais (venda=${message.data.vendasHeaderId}). Aceitos: ${result.accepted.join(', ')} | Rejeitados: ${result.rejected.join(', ')}`,
                );
                break;
            }

            log.info(`Email de relatorio de vendas enviado com sucesso para: ${message.data.email}`);
            break;
        }

        default:
            log.warn(`Tipo de email desconhecido: ${(message as any).type}`);
            throw new Error(`Tipo de email desconhecido`);
    }
}

export async function startEmailConsumer(): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        // Prefetch: define quantas mensagens não confirmadas o consumer pode processar simultaneamente
        await channel.prefetch(Config.RABBITMQ_PREFETCH);

        log.info(`Consumidor de emails iniciado (prefetch: ${Config.RABBITMQ_PREFETCH}). Aguardando mensagens na fila: ${QUEUES.EMAIL}`);

        await channel.consume(
            QUEUES.EMAIL,
            async (msg: ConsumeMessage | null) => {
                if (!msg) {
                    return;
                }

                try {
                    const messageContent = msg.content.toString();
                    const emailMessage: EmailQueueMessage = JSON.parse(messageContent);

                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

                    log.info(`Processando email do tipo: ${emailMessage.type} (tentativa ${retryCount + 1}/${MAX_RETRIES})`);

                    await processEmailMessage(emailMessage);

                    // ACK manual: confirma que a mensagem foi processada com sucesso
                    channel.ack(msg);
                } catch (error) {
                    const emailConsumerError = error instanceof Error ? error : new Error(String(error));

                    log.error('Erro ao processar mensagem da fila de emails: %o', emailConsumerError);

                    try {
                        // Registrar falha no APM
                        apm.captureError(emailConsumerError);

                        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
                        if (retryCount < MAX_RETRIES - 1) {
                            // Reenviar para a fila com contador de retry incrementado
                            log.warn(`Reenviando mensagem para retry (tentativa ${retryCount + 2}/${MAX_RETRIES})`);
                            
                            channel.sendToQueue(QUEUES.EMAIL, msg.content, {
                                persistent: true,
                                headers: {
                                    'x-retry-count': retryCount + 1,
                                },
                            });

                            // ACK para remover a mensagem original
                            channel.ack(msg);
                        } else {
                            // Após MAX_RETRIES tentativas, envia para DLQ
                            log.error(`Mensagem falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`);
                            
                            // NACK com requeue=false: envia para Dead Letter Queue
                            channel.nack(msg, false, false);
                        }
                    } catch (apmError) {
                        log.error('Erro ao registrar falha no APM: %o', apmError);
                    }
                }
            },
            {
                noAck: false, // ACK manual
            }
        );
    } catch (error) {
        log.error('Erro ao iniciar consumidor de emails: %o', error);
        throw error;
    }
}
