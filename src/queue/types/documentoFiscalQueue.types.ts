export enum DocumentoFiscalQueueType {
    PROCESSAR_DETALHES = 'PROCESSAR_DETALHES',
    PROCESSAR_DETALHES_POS = 'PROCESSAR_DETALHES_POS',
}

export interface ProcessarDetalhesMessage {
    type: DocumentoFiscalQueueType.PROCESSAR_DETALHES;
    timestamp: Date;
    data: {
        documentoFiscalHeaderId: number;
    };
}

export interface ProcessarDetalhesPosMessage {
    type: DocumentoFiscalQueueType.PROCESSAR_DETALHES_POS;
    timestamp: Date;
    data: {
        documentoFiscalHeaderId: number;
        filtros: {
            dataEmissaoDe?: string;
            dataEmissaoAte?: string;
            codigoFornecedorDe?: string;
            codigoFornecedorAte?: string;
            segmento?: string;
        };
        fornecedorCardCode?: string; // Agora opcional - quando não informado, processa todos do grupo
    };
}

export type DocumentoFiscalQueueMessage = ProcessarDetalhesMessage | ProcessarDetalhesPosMessage;

