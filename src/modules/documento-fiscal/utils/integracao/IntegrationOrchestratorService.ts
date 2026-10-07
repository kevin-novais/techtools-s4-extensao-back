import log from "@/util/logger";
import { IntegrationValidator } from "@/modules/documento-fiscal/utils/integracao/IntegrationValidator";
import { IntegrationRunner, IntegrationResult } from "@/modules/documento-fiscal/utils/integracao/IntegrationRunner";
import { IntegrationQueuePublisher } from "@/modules/documento-fiscal/utils/integracao/IntegrationQueuePublisher";

type OrigemIntegracao = "POS" | "ROM" | "MANUAL";

interface EnqueueParams {
    documentoFiscalHeaderId: number;
    usuarioId: number;
    origem: OrigemIntegracao;
    allowedStatuses?: string[];
}

interface IntegrateParams extends EnqueueParams {
    failFast?: boolean;
    updateStatus?: boolean;
}

interface IntegrateResult {
    status: "integrado" | "ignorado";
    resultados: IntegrationResult[];
}

export class IntegrationOrchestratorService {
    private readonly validator: IntegrationValidator;
    private readonly runner: IntegrationRunner;
    private readonly publisher: IntegrationQueuePublisher;

    constructor() {
        this.validator = new IntegrationValidator();
        this.runner = new IntegrationRunner();
        this.publisher = new IntegrationQueuePublisher();
    }

    async enqueue(params: EnqueueParams): Promise<{ status: "enfileirado" | "ignorado" }> {
        const { documentoFiscalHeaderId, usuarioId, origem, allowedStatuses } = params;

        const documento = await this.validator.validate(documentoFiscalHeaderId, allowedStatuses);

        if (!documento) {
            return { status: "ignorado" };
        }

        return this.publisher.enqueue({
            documentoFiscalHeaderId,
            usuarioId,
            origem,
        });
    }

    async integrate(params: IntegrateParams): Promise<IntegrateResult> {
        const {
            documentoFiscalHeaderId,
            usuarioId,
            origem,
            failFast = true,
            allowedStatuses,
        } = params;

        const documento = await this.validator.validate(documentoFiscalHeaderId, allowedStatuses);

        if (!documento) {
            return { status: "ignorado", resultados: [] };
        }

        const resultados = await this.runner.execute({
            documentoFiscalHeaderId,
            usuarioId,
            failFast,
        });

        log.info(
            `[IntegrationOrchestrator] Documento ${documentoFiscalHeaderId} integrado com sucesso (origem=${origem})`
        );

        return { status: "integrado", resultados };
    }
}
