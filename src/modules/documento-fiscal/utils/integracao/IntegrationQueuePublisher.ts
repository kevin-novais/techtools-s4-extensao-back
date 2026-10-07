import log from "@/util/logger";
import { publishIntegrarDocumentoFiscal } from "@/queue/producers/sapIntegrationProducer";

interface EnqueueParams {
    documentoFiscalHeaderId: number;
    usuarioId: number;
    origem: "POS" | "ROM" | "MANUAL";
}

export class IntegrationQueuePublisher {
    async enqueue(params: EnqueueParams): Promise<{ status: "enfileirado" }> {
        const { documentoFiscalHeaderId, usuarioId, origem } = params;

        await publishIntegrarDocumentoFiscal({
            documentoFiscalHeaderId,
            usuarioId,
        });

        log.info(
            `[IntegrationQueuePublisher] Documento ${documentoFiscalHeaderId} enfileirado para integração SAP (origem=${origem})`
        );

        return { status: "enfileirado" };
    }
}
