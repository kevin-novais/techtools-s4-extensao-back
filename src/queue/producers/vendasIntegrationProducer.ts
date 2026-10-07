import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { VendasIntegrationQueueType, IntegrarVendasMessage } from '@/queue/types/vendasIntegrationQueue.types';
import log from '@/util/logger';

interface PublishIntegrarVendasProps {
    vendasHeaderId: number;
}

export async function publishIntegrarVendas(props: PublishIntegrarVendasProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: IntegrarVendasMessage = {
            type: VendasIntegrationQueueType.INTEGRAR_VENDAS,
            timestamp: new Date(),
            data: {
                vendasHeaderId: props.vendasHeaderId,
            },
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.VENDAS_INTEGRATION, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Integração SAP da venda ${props.vendasHeaderId} publicada na fila`);
    } catch (error) {
        log.error('Erro ao publicar integração de vendas na fila: %o', error);
        throw error;
    }
}
