import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { SapIntegrationQueueType, IntegrarDocumentoMessage } from '@/queue/types/sapIntegrationQueue.types';
import log from '@/util/logger';

interface PublishIntegrarDocumentoFiscalProps {
    documentoFiscalHeaderId: number;
    usuarioId: number;
}

export async function publishIntegrarDocumentoFiscal(props: PublishIntegrarDocumentoFiscalProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: IntegrarDocumentoMessage = {
            type: SapIntegrationQueueType.INTEGRAR_DOCUMENTO,
            timestamp: new Date(),
            data: {
                documentoFiscalHeaderId: props.documentoFiscalHeaderId,
                usuarioId: props.usuarioId,
            },
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.SAP_INTEGRATION, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Integração SAP do documento fiscal ${props.documentoFiscalHeaderId} publicada na fila`);
    } catch (error) {
        log.error('Erro ao publicar integração SAP na fila: %o', error);
        throw error;
    }
}
