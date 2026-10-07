import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import { DocumentoFiscalQueueType, ProcessarDetalhesMessage, ProcessarDetalhesPosMessage } from '@/queue/types/documentoFiscalQueue.types';
import log from '@/util/logger';

interface PublishProcessarDetalhesProps {
    documentoFiscalHeaderId: number;
}

export async function publishProcessarDetalhes(props: PublishProcessarDetalhesProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: ProcessarDetalhesMessage = {
            type: DocumentoFiscalQueueType.PROCESSAR_DETALHES,
            timestamp: new Date(),
            data: props,
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.DOCUMENTO_FISCAL, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Processamento de detalhes do documento fiscal ${props.documentoFiscalHeaderId} publicado na fila`);
    } catch (error) {
        log.error('Erro ao publicar processamento de detalhes na fila: %o', error);
        throw error;
    }
}

interface PublishProcessarDetalhesPosProps {
    documentoFiscalHeaderId: number;
    filtros: {
        dataEmissaoDe?: string;
        dataEmissaoAte?: string;
        codigoFornecedorDe?: string;
        codigoFornecedorAte?: string;
        segmento?: string;
    };
    fornecedorCardCode?: string; // Agora opcional - quando não informado, processa todos do grupo
}

export async function publishProcessarDetalhesPOS(props: PublishProcessarDetalhesPosProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: ProcessarDetalhesPosMessage = {
            type: DocumentoFiscalQueueType.PROCESSAR_DETALHES_POS,
            timestamp: new Date(),
            data: {
                documentoFiscalHeaderId: props.documentoFiscalHeaderId,
                filtros: props.filtros,
                fornecedorCardCode: props.fornecedorCardCode,
            },
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.DOCUMENTO_FISCAL, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        const fornecedorInfo = props.fornecedorCardCode
            ? `(fornecedor: ${props.fornecedorCardCode})`
            : '(todos os fornecedores do grupo)';
        log.info(`Processamento de detalhes POS do documento fiscal ${props.documentoFiscalHeaderId} ${fornecedorInfo} publicado na fila`);
    } catch (error) {
        log.error('Erro ao publicar processamento de detalhes POS na fila: %o', error);
        throw error;
    }
}

