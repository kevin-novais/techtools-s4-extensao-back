import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { VendaRecDiferidaGerarParcelasService } from "@/modules/vendas/services/VendaRecDiferidaGerarParcelasService";
import { VendasIntegrationResult, VendasIntegrationRunner } from "@/modules/vendas/utils/integracao/VendasIntegrationRunner";
import { GerarRelatorioVendasService } from "@/modules/vendas/utils/relatorio/GerarRelatorioVendasService";
import log from "@/util/logger";

interface IntegrateParams {
    vendasHeaderId: number;
    failFast?: boolean;
    updateStatus?: boolean;
}

interface IntegrateResult {
    status: "integrado" | "ignorado";
    resultados: VendasIntegrationResult[];
}

export class VendasIntegrationOrchestratorService {
    private readonly runner: VendasIntegrationRunner;
    private readonly relatorioService: GerarRelatorioVendasService;
    private readonly gerarParcelasService: VendaRecDiferidaGerarParcelasService;

    constructor() {
        this.runner = new VendasIntegrationRunner();
        this.relatorioService = new GerarRelatorioVendasService();
        this.gerarParcelasService = new VendaRecDiferidaGerarParcelasService();
    }

    async integrate(params: IntegrateParams): Promise<IntegrateResult> {
        const { vendasHeaderId, failFast = true, updateStatus = true } = params;

        // Validar que a venda existe e está em status processável
        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: { id: true, status: true, codigoClienteAnalyzer: true },
        });

        if (!venda) {
            throw new Error(`Venda ${vendasHeaderId} não encontrada`);
        }

        if (venda.status === StatusVendas.INTEG_SAP) {
            log.warn(`[VendasIntegrationOrchestrator] Venda ${vendasHeaderId} já está integrada. Ignorando.`);
            return { status: "ignorado", resultados: [] };
        }

        const resultados = await this.runner.execute({
            vendasHeaderId,
            failFast,
        });

        if (updateStatus) {
            // Extrair codigoDocumentoERP da resposta do SAP
            const successResult = resultados.find(r => r.status === "sucesso" || r.status === "conflito");
            const codigoDocumentoERP = successResult?.numeroDocumentoERP ?? null;
            const dataVencimento = successResult?.dataVencimento ?? null;
            await s4DotzClient.vendasHeader.update({
                where: { id: vendasHeaderId },
                data: {
                    status: StatusVendas.INTEG_SAP,
                    codigoDocumentoERP,
                    dataVencimento,
                    dataIntegracao: new Date(),
                    atualizadoEm: new Date(),
                },
            });

            // Gerar relatórios após SAP (com codigoDocumentoERP disponível)
            try {
                await this.relatorioService.execute({ vendasHeaderId });
                log.info(`[VendasIntegrationOrchestrator] Relatórios gerados para venda ${vendasHeaderId}`);
            } catch (error) {
                log.error(`[VendasIntegrationOrchestrator] Erro ao gerar relatórios para venda ${vendasHeaderId}: %o`, error);
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasHeaderId },
                    data: {
                        status: StatusVendas.ERRO_FATURA,
                        atualizadoEm: new Date(),
                    },
                });
            }

            try {
                const isBoleto = await this.fetchClientePagamentoViaBoleto(vendasHeaderId);

                let statusUpdate = isBoleto ? StatusVendas.AGUARDANDO_BOLETO : StatusVendas.ENVIANDO_EMAIL;
                log.info(`[VendasIntegrationOrchestrator] Relatórios forma de pagamento boleto : ${statusUpdate} para venda ${vendasHeaderId}`);
                //Aguarda o boleto ser gerado para enviar o email, caso seja boleto, caso contrario envia o email normalmente.
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasHeaderId },
                    data: {
                        status: statusUpdate,
                        atualizadoEm: new Date(),
                    },
                });
            } catch (error) {
                log.error(`[VendasIntegrationOrchestrator] Erro ao gerar relatórios para venda ${vendasHeaderId}: %o`, error);
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasHeaderId },
                    data: {
                        status: StatusVendas.ERRO_PROC,
                        atualizadoEm: new Date(),
                    },
                });
                throw new Error(`[VendasIntegrationOrchestrator] Erro ao buscar forma de pagamento para venda ${vendasHeaderId}: ${error}`);
            }

            // Gerar parcelas diferidas (idempotente — só cria se configuração RD existir)
            try {
                const resultadoDiferidas = await this.gerarParcelasService.execute({ vendasHeaderId });
                log.info(`[VendasIntegrationOrchestrator] ${resultadoDiferidas.totalParcelas} parcelas diferidas geradas para venda ${vendasHeaderId}`,);
            } catch (error) {
                log.error(
                    `[VendasIntegrationOrchestrator] Erro ao gerar parcelas diferidas para venda ${vendasHeaderId}: %o`,
                    error,
                );
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasHeaderId },
                    data: {
                        status: StatusVendas.ERRO_PROC,
                        atualizadoEm: new Date(),
                    },
                });
                throw new Error(`[VendasIntegrationOrchestrator] Erro ao gerar parcelas diferidas para venda ${vendasHeaderId}: ${error}`);
            }

            log.info(
                `[VendasIntegrationOrchestrator] Venda ${vendasHeaderId} integrada com sucesso`,
            );
        }

        return { status: "integrado", resultados };
    }

    public async fetchClientePagamentoViaBoleto(vendasHeaderId: number) {
        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: { codigoClienteSAP: true },
        });


        const result = await dotzStageClient().oCRD.findFirst({
            select: {
                FORMA_PAGAMENTO: true,
            },
            where: {
                CardCode: venda.codigoClienteSAP,
                ativo: true,
            },
        });
        if (!result.FORMA_PAGAMENTO || !result.FORMA_PAGAMENTO) {
            return false;
        }
        return result.FORMA_PAGAMENTO.trim() === "E" ? true : false;
    }
}
