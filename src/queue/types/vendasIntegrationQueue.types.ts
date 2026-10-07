export enum VendasIntegrationQueueType {
    INTEGRAR_VENDAS = 'INTEGRAR_VENDAS',
}

export interface IntegrarVendasMessage {
    type: VendasIntegrationQueueType.INTEGRAR_VENDAS;
    timestamp: Date;
    data: {
        vendasHeaderId: number;
    };
}

export type VendasIntegrationQueueMessage = IntegrarVendasMessage;
