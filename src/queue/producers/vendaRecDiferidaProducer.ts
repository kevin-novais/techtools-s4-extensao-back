import { rabbitmqConnection, QUEUES } from "@/queue/config/rabbitmq";
import {
    VendaRecDiferidaQueueType,
    IntegrarDiferidaMessage,
    ReverterDiferidaMessage,
} from "@/queue/types/vendaRecDiferidaQueue.types";
import log from "@/util/logger";

interface PublishProps {
    vendaRecDiferidaId: number;
}

export async function publishIntegrarDiferida(props: PublishProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: IntegrarDiferidaMessage = {
            type: VendaRecDiferidaQueueType.INTEGRAR_DIFERIDA,
            timestamp: new Date(),
            data: { vendaRecDiferidaId: props.vendaRecDiferidaId },
        };

        channel.sendToQueue(
            QUEUES.VENDA_REC_DIFERIDA_INTEGRATION,
            Buffer.from(JSON.stringify(message)),
            { persistent: true, headers: { "x-retry-count": 0 } },
        );

        log.info(`Integração de diferida ${props.vendaRecDiferidaId} publicada na fila`);
    } catch (error) {
        log.error("Erro ao publicar integração de diferida na fila: %o", error);
        throw error;
    }
}

export async function publishReverterDiferida(props: PublishProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: ReverterDiferidaMessage = {
            type: VendaRecDiferidaQueueType.REVERTER_DIFERIDA,
            timestamp: new Date(),
            data: { vendaRecDiferidaId: props.vendaRecDiferidaId },
        };

        channel.sendToQueue(
            QUEUES.VENDA_REC_DIFERIDA_REVERSAO,
            Buffer.from(JSON.stringify(message)),
            { persistent: true, headers: { "x-retry-count": 0 } },
        );

        log.info(`Reversão de diferida ${props.vendaRecDiferidaId} publicada na fila`);
    } catch (error) {
        log.error("Erro ao publicar reversão de diferida na fila: %o", error);
        throw error;
    }
}
