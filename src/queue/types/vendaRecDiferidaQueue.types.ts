export enum VendaRecDiferidaQueueType {
    INTEGRAR_DIFERIDA = "INTEGRAR_DIFERIDA",
    REVERTER_DIFERIDA = "REVERTER_DIFERIDA",
}

export interface IntegrarDiferidaMessage {
    type: VendaRecDiferidaQueueType.INTEGRAR_DIFERIDA;
    timestamp: Date;
    data: {
        vendaRecDiferidaId: number;
    };
}

export interface ReverterDiferidaMessage {
    type: VendaRecDiferidaQueueType.REVERTER_DIFERIDA;
    timestamp: Date;
    data: {
        vendaRecDiferidaId: number;
    };
}

export type VendaRecDiferidaQueueMessage = IntegrarDiferidaMessage | ReverterDiferidaMessage;
