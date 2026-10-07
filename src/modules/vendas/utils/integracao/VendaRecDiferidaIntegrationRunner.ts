import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { BuildSapIntegrationVendaRecDiferida } from "@/modules/vendas/utils/BuildSapIntegrationVendaRecDiferida";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";

export interface VendaRecDiferidaIntegrationResult {
    vendaRecDiferidaId: number;
    status: "sucesso" | "conflito" | "erro";
    statusCode: number;
    codigoDocumentoErp?: string;
    mensagem?: string;
}

interface RunnerParams {
    vendaRecDiferidaId: number;
}

export class VendaRecDiferidaIntegrationRunner {
    private readonly buildService: BuildSapIntegrationVendaRecDiferida;
    private readonly integracaoService: IntegracaoSapCreateJournalEntryService;

    constructor() {
        this.buildService = new BuildSapIntegrationVendaRecDiferida();
        this.integracaoService = new IntegracaoSapCreateJournalEntryService();
    }

    async execute(params: RunnerParams): Promise<VendaRecDiferidaIntegrationResult> {
        const { vendaRecDiferidaId } = params;

        const parcela = await s4DotzClient.vendaRecDiferida.findUnique({
            where: { id: vendaRecDiferidaId },
            select: { id: true, status: true, dataDiferimento: true, vendasHeaderId: true },
        });

        if (!parcela) {
            return {
                vendaRecDiferidaId,
                status: "erro",
                statusCode: 404,
                mensagem: "Parcela diferida não encontrada",
            };
        }

        if (parcela.status === StatusVendaRecDiferida.INTEGRADO) {
            log.warn(
                `[VendaRecDiferidaIntegrationRunner] Parcela ${vendaRecDiferidaId} já está INTEGRADA. Ignorando.`,
            );
            return { vendaRecDiferidaId, status: "conflito", statusCode: 409, mensagem: "Parcela já integrada" };
        }

        const integracaoJson = await this.buildService.execute({ vendaRecDiferidaId });
        const requestSap = JSON.stringify(integracaoJson);

        await s4DotzClient.vendaRecDiferida.update({
            where: { id: vendaRecDiferidaId },
            data: {
                requestSap,
                responseSap: null,
                dataIntegracao: new Date(),
            },
        });

        try {
            log.info(
                `[VendaRecDiferidaIntegrationRunner] Integrando parcela ${vendaRecDiferidaId} (venda ${parcela.vendasHeaderId}) no SAP`,
            );

            const response = await this.integracaoService.execute(integracaoJson);
            const responseSap = JSON.stringify(response.data ?? null);

            if (response.status === 201 || response.status === 409) {
                const codigoDocumentoErp = response.data?.numeroDocumentoERP ?? null;
                const anoFiscal = parcela.dataDiferimento
                    ? parcela.dataDiferimento.getUTCFullYear()
                    : new Date().getUTCFullYear();

                await s4DotzClient.vendaRecDiferida.update({
                    where: { id: vendaRecDiferidaId },
                    data: {
                        status: StatusVendaRecDiferida.INTEGRADO,
                        codigoDocumentoErp,
                        anoFiscalLancamento: anoFiscal,
                        responseSap,
                    },
                });

                log.info(
                    `[VendaRecDiferidaIntegrationRunner] Parcela ${vendaRecDiferidaId} integrada com sucesso. Documento: ${codigoDocumentoErp}`,
                );

                return {
                    vendaRecDiferidaId,
                    status: response.status === 201 ? "sucesso" : "conflito",
                    statusCode: response.status,
                    codigoDocumentoErp: codigoDocumentoErp ?? undefined,
                    mensagem: response.data?.mensagem || "Integração concluída",
                };
            }

            const mensagem = response.data?.mensagem || `Status inesperado: ${response.status}`;
            await this.marcarErroIntegracao(vendaRecDiferidaId, responseSap);

            return { vendaRecDiferidaId, status: "erro", statusCode: response.status, mensagem };
        } catch (error: any) {
            const statusCode = error.response?.status || 500;
            const mensagem =
                error.response?.data?.mensagem?.erro ||
                (typeof error.response?.data?.mensagem === "string"
                    ? error.response?.data?.mensagem
                    : null) ||
                error.message ||
                "Erro desconhecido";
            const responseSap = JSON.stringify(
                error.response?.data ?? { statusCode, mensagem },
            );

            log.error(
                `[VendaRecDiferidaIntegrationRunner] Erro na integração SAP para parcela ${vendaRecDiferidaId}: status ${statusCode} - ${mensagem}`,
            );
            log.error(
                `[VendaRecDiferidaIntegrationRunner] Payload enviado: ${JSON.stringify(integracaoJson)}`,
            );
            log.error(
                `[VendaRecDiferidaIntegrationRunner] Corpo da resposta SAP: ${JSON.stringify(error.response?.data)}`,
            );

            await this.marcarErroIntegracao(vendaRecDiferidaId, responseSap);
            throw error;
        }
    }

    private async marcarErroIntegracao(vendaRecDiferidaId: number, responseSap: string): Promise<void> {
        try {
            await s4DotzClient.vendaRecDiferida.update({
                where: { id: vendaRecDiferidaId },
                data: {
                    status: StatusVendaRecDiferida.ERRO_INTEG,
                    responseSap,
                },
            });
        } catch (updateError) {
            log.error(
                `[VendaRecDiferidaIntegrationRunner] Falha ao marcar ERRO_INTEG para parcela ${vendaRecDiferidaId}: %o`,
                updateError,
            );
        }
    }
}
