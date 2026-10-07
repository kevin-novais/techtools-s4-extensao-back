export enum SapIntegrationQueueType {
    INTEGRAR_DOCUMENTO = 'INTEGRAR_DOCUMENTO',
}

export interface IntegrarDocumentoMessage {
    type: SapIntegrationQueueType.INTEGRAR_DOCUMENTO;
    timestamp: Date;
    data: {
        documentoFiscalHeaderId: number;
        usuarioId: number;
    };
}

export type SapIntegrationQueueMessage = IntegrarDocumentoMessage;
