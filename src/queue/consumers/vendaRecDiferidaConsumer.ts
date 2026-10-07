import { Channel, type ConsumeMessage } from "amqplib";
import { rabbitmqConnection, QUEUES } from "@/queue/config/rabbitmq";
import {
    VendaRecDiferidaQueueMessage,
    VendaRecDiferidaQueueType,
} from "@/queue/types/vendaRecDiferidaQueue.types";
import { Config } from "@/config/config";
import log from "@/util/logger";
import AppError from "@/util/AppError";
import { VendaRecDiferidaIntegrationRunner } from "@/modules/vendas/utils/integracao/VendaRecDiferidaIntegrationRunner";
import { VendaRecDiferidaReversaoService } from "@/modules/vendas/utils/integracao/VendaRecDiferidaReversaoService";
import apm from "@/apm";

const MAX_RETRIES = 2;
const integrationRunner = new VendaRecDiferidaIntegrationRunner();
const reversaoService = new VendaRecDiferidaReversaoService();

async function processMessage(message: VendaRecDiferidaQueueMessage): Promise<void> {
    if (message.type === VendaRecDiferidaQueueType.INTEGRAR_DIFERIDA) {
        const { vendaRecDiferidaId } = message.data;
        log.info(`[VendaRecDiferidaConsumer] Integrando diferida ${vendaRecDiferidaId}`);
        await integrationRunner.execute({ vendaRecDiferidaId });
        return;
    }

    if (message.type === VendaRecDiferidaQueueType.REVERTER_DIFERIDA) {
        const { vendaRecDiferidaId } = message.data;
        log.info(`[VendaRecDiferidaConsumer] Revertendo diferida ${vendaRecDiferidaId}`);
        await reversaoService.execute({ vendaRecDiferidaId });
        return;
    }

    log.warn(`[VendaRecDiferidaConsumer] Tipo de mensagem desconhecido: ${(message as any).type}`);
    throw new Error("Tipo de mensagem desconhecido");
}

async function startConsumer(queueName: string): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();
        await channel.prefetch(Config.RABBITMQ_PREFETCH_VENDA_REC_DIFERIDA);

        log.info(
            `Consumidor de diferidas iniciado (prefetch: ${Config.RABBITMQ_PREFETCH_VENDA_REC_DIFERIDA}). Fila: ${queueName}`,
        );

        await channel.consume(
            queueName,
            async (msg: ConsumeMessage | null) => {
                if (!msg) return;

                try {
                    run(channel, msg, queueName);
                } catch(error) {
                    // Registrar falha no APM
                    apm.captureError(error instanceof Error ? error : new Error(String(error)));
                }
            },
            { noAck: false },
        );
    } catch (error) {
        log.error(`Erro ao iniciar consumidor de diferidas (${queueName}): %o`, error);
        throw error;
    }
}

async function run(channel: Channel, msg: ConsumeMessage, queueName:string): Promise<void> {
    try {
        const queueMessage: VendaRecDiferidaQueueMessage = JSON.parse(
            msg.content.toString(),
        );
        const retryCount = msg.properties.headers?.["x-retry-count"] || 0;
        log.info(`Processando diferida tipo: ${queueMessage.type} (tentativa ${retryCount + 1}/${MAX_RETRIES})`,);

        await processMessage(queueMessage);
        channel.ack(msg);
    } catch (error) {
        if (error instanceof AppError) {
            log.error(`Erro de negócio ao processar diferida: ${error.message}`);
            channel.ack(msg);
            return;
        }

        const msgErro =
            (error as any).response?.data?.mensagem?.erro ||
            (error as any).message ||
            "Erro desconhecido";
        const statusErro = (error as any).response?.status;
        const statusSuffix = statusErro ? ` (status ${statusErro})` : "";
        log.error(`Erro ao processar diferida: ${msgErro}${statusSuffix}`);

        const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

        if (retryCount < MAX_RETRIES - 1) {
            log.warn(`Reenviando diferida para retry (tentativa ${retryCount + 2}/${MAX_RETRIES})`);
            channel.sendToQueue(queueName, msg.content, {
                persistent: true,
                headers: { "x-retry-count": retryCount + 1 },
            });
            channel.ack(msg);
        } else {
            log.error(`Diferida falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`);
            channel.nack(msg, false, false);
        }
    }
}

export async function startVendaRecDiferidaConsumer(): Promise<void> {
    await startConsumer(QUEUES.VENDA_REC_DIFERIDA_INTEGRATION);
}

export async function startVendaRecDiferidaReversaoConsumer(): Promise<void> {
    await startConsumer(QUEUES.VENDA_REC_DIFERIDA_REVERSAO);
}
