import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";
import { IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";
import { Config } from "@/config/config";

export interface VendaRecDiferidaReversaoResult {
    vendaRecDiferidaId: number;
    status: "sucesso" | "conflito" | "erro";
    statusCode: number;
    codigoDocumentoErpReversao?: string;
    mensagem?: string;
}

interface ReversaoParams {
    vendaRecDiferidaId: number;
}

export class VendaRecDiferidaReversaoService {
    private readonly integracaoService: IntegracaoSapCreateJournalEntryService;
    private readonly USUARIO_LANCAMENTO_PADRAO = Config.S4_HANA_CLOUD_USER_NAME;

    constructor() {
        this.integracaoService = new IntegracaoSapCreateJournalEntryService();
    }

    async execute(params: ReversaoParams): Promise<VendaRecDiferidaReversaoResult> {
        const { vendaRecDiferidaId } = params;

        const parcela = await s4DotzClient.vendaRecDiferida.findUnique({
            where: { id: vendaRecDiferidaId },
            select: {
                id: true,
                status: true,
                vendasHeaderId: true,
                periodoDiferimento: true,
                tipo: true,
                dataDiferimento: true,
                valorDiferimento: true,
                tipoContabilErpReversao: true,
                tipoDocumentoErpReversao: true,
                contaCreditoReversao: true,
                contaDebitoReversao: true,
                centroLucroReversao: true,
                centroCustoReversao: true,
                tipoContabilErp: true,
                tipoDocumentoErp: true,
                contaCredito: true,
                contaDebito: true,
                centroLucro: true,
                centroCusto: true,
                vendasHeader: {
                    select: {
                        ciaIdSAP: true,
                        codigoClienteSAP: true,
                        numeroDocumentoAnalyzer: true,
                    },
                },
            },
        });

        if (!parcela) throw new AppError("Parcela diferida não encontrada", 404);

        if (parcela.status !== StatusVendaRecDiferida.REVERSAO_PENDENTE) {
            throw new AppError(
                `Parcela ${vendaRecDiferidaId} não está em status REVERSAO_PENDENTE (atual: ${parcela.status})`,
                400,
            );
        }

        if (!parcela.dataDiferimento) throw new AppError("Parcela sem dataDiferimento definida", 400);

        if (!parcela.valorDiferimento) throw new AppError("Parcela sem valorDiferimento definida", 400);

        if (!parcela.vendasHeader.codigoClienteSAP) {
            throw new AppError("Venda não possui código de cliente SAP", 400);
        }

        const cia = await s4DotzClient.cia.findFirst({
            where: { ciaIdSAP: parcela.vendasHeader.ciaIdSAP, deletadoEm: null },
            select: { ciaIdSAP: true },
        });

        if (!cia?.ciaIdSAP) {
            throw new AppError(
                `CIA com ciaIdSAP ${parcela.vendasHeader.ciaIdSAP} não encontrada`,
                400,
            );
        }

        const integracaoJson = this.buildReversaoJson(parcela, cia.ciaIdSAP);
        const requestSap = JSON.stringify(integracaoJson);

        await s4DotzClient.vendaRecDiferida.update({
            where: { id: vendaRecDiferidaId },
            data: { requestSap, responseSap: null },
        });

        try {
            log.info(
                `[VendaRecDiferidaReversao] Revertendo parcela ${vendaRecDiferidaId} (venda ${parcela.vendasHeaderId}) no SAP`,
            );

            const response = await this.integracaoService.execute(integracaoJson);
            const responseSap = JSON.stringify(response.data ?? null);

            if (response.status === 201 || response.status === 409) {
                const codigoDocumentoErpReversao = response.data?.numeroDocumentoERP ?? null;
                const anoReversao = new Date().getUTCFullYear();
                const dataReversao = new Date();

                await s4DotzClient.vendaRecDiferida.update({
                    where: { id: vendaRecDiferidaId },
                    data: {
                        status: StatusVendaRecDiferida.REVERTIDO,
                        codigoDocumentoErpReversao,
                        dataDoLancamentoDaReversao: dataReversao,
                        anoReversao,
                        responseSap,
                    },
                });

                log.info(
                    `[VendaRecDiferidaReversao] Parcela ${vendaRecDiferidaId} revertida. Documento: ${codigoDocumentoErpReversao}`,
                );

                return {
                    vendaRecDiferidaId,
                    status: response.status === 201 ? "sucesso" : "conflito",
                    statusCode: response.status,
                    codigoDocumentoErpReversao: codigoDocumentoErpReversao ?? undefined,
                    mensagem: response.data?.mensagem || "Reversão concluída",
                };
            }

            const mensagem = response.data?.mensagem || `Status inesperado: ${response.status}`;
            await this.marcarErroReversao(vendaRecDiferidaId, responseSap);

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
                `[VendaRecDiferidaReversao] Erro SAP para parcela ${vendaRecDiferidaId}: status ${statusCode} - ${mensagem}`,
            );

            await this.marcarErroReversao(vendaRecDiferidaId, responseSap);
            throw error;
        }
    }

    private buildReversaoJson(parcela: any, ciaIdSAP: string): IntegracaoSAPJson {
        const dataFormatada = this.formatDateOnly(parcela.dataDiferimento);
        const valor = Number(parcela.valorDiferimento);

        // Usa campos de reversão se preenchidos; caso contrário inverte débito/crédito do original
        const tipoArApGl = parcela.tipoContabilErpReversao || parcela.tipoContabilErp || "GL";
        const tipoDocumento = parcela.tipoDocumentoErpReversao || parcela.tipoDocumentoErp || "RD";
        const contaCredito = parcela.contaCreditoReversao || parcela.contaDebito;
        const contaDebito = parcela.contaDebitoReversao || parcela.contaCredito;
        const centroLucro = parcela.centroLucroReversao || parcela.centroLucro || "";
        const centroCusto = parcela.centroCustoReversao || parcela.centroCusto || "";

        const lancamentosContabeis: IntegracaoSAPJson["lancamentosContabeis"] = [];

        if (contaDebito) {
            lancamentosContabeis.push({ conta: contaDebito, centroCusto, centroLucro, valor });
        }

        if (contaCredito) {
            lancamentosContabeis.push({ conta: contaCredito, centroCusto, centroLucro, valor });
        }

        const sufixoTipo = this.getSufixoTipo(parcela.tipo);
        const numeroDocumento = parcela.vendasHeader.numeroDocumentoAnalyzer
            ? `REV-${parcela.vendasHeader.numeroDocumentoAnalyzer}-${String(parcela.periodoDiferimento).padStart(2, "0")}-${sufixoTipo}`
            : `REV-${parcela.vendasHeaderId}-${String(parcela.periodoDiferimento).padStart(2, "0")}-${sufixoTipo}`;

        return {
            tipoArApGl,
            tipoDocumento,
            codigoCia: ciaIdSAP,
            numeroDocumento,
            textoDocumento: `Reversão receita diferida ${sufixoTipo.toLowerCase()} - período ${parcela.periodoDiferimento}`,
            valorDocumento: valor,
            codigoParceiro: parcela.vendasHeader.codigoClienteSAP,
            dataEmissao: dataFormatada,
            dataVencimento: dataFormatada,
            condicaoPagto: "",
            dataLancamento: this.formatDateOnly(new Date()),
            usuarioLancamento: this.USUARIO_LANCAMENTO_PADRAO,
            lancamentosContabeis,
            anexos: [],
        };
    }

    private async marcarErroReversao(vendaRecDiferidaId: number, responseSap: string): Promise<void> {
        try {
            await s4DotzClient.vendaRecDiferida.update({
                where: { id: vendaRecDiferidaId },
                data: { status: StatusVendaRecDiferida.ERRO_REVERT, responseSap },
            });
        } catch (updateError) {
            log.error(
                `[VendaRecDiferidaReversao] Falha ao marcar ERRO_REVERT para parcela ${vendaRecDiferidaId}: %o`,
                updateError,
            );
        }
    }

    private formatDateOnly(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private getSufixoTipo(tipo: string): "TOTAL" | "VENDA" {
        return tipo === "DIFERIDO_VENDA" ? "VENDA" : "TOTAL";
    }
}
