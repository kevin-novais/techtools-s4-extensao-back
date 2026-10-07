import { Config } from "@/config/config";
import type { ConfiguracaoContabilDetalhe } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";
import AppError from "@/util/AppError";

export interface BuildSapDiferidaParams {
    vendaRecDiferidaId: number;
}

export class BuildSapIntegrationVendaRecDiferida {
    private readonly USUARIO_LANCAMENTO_PADRAO = Config.S4_HANA_CLOUD_USER_NAME;

    async execute(params: BuildSapDiferidaParams): Promise<IntegracaoSAPJson> {
        const { vendaRecDiferidaId } = params;

        const parcela = await s4DotzClient.vendaRecDiferida.findUnique({
            where: { id: vendaRecDiferidaId },
            select: {
                id: true,
                vendasHeaderId: true,
                periodoDiferimento: true,
                tipo: true,
                status: true,
                dataDiferimento: true,
                valorDiferimento: true,
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

        if (!parcela.dataDiferimento) throw new AppError("Parcela sem dataDiferimento definida", 400);

        if (!parcela.valorDiferimento) throw new AppError("Parcela sem valorDiferimento definida", 400);

        if (!parcela.vendasHeader.codigoClienteSAP) {
            throw new AppError("Venda não possui código de cliente SAP", 400);
        }

        const cia = await s4DotzClient.cia.findFirst({
            where: { ciaIdSAP: parcela.vendasHeader.ciaIdSAP, deletadoEm: null },
            select: { id: true, ciaIdSAP: true },
        });

        if (!cia) {
            throw new AppError(
                `CIA com ciaIdSAP ${parcela.vendasHeader.ciaIdSAP} não encontrada`,
                400,
            );
        }

        const configuracaoContabil = await this.fetchConfiguracaoContabilRD(cia.id);

        if (!configuracaoContabil) {
            throw new AppError(`Configuração contábil RD não encontrada para a CIA ${cia.ciaIdSAP}`, 400);
        }

        const detalhe = configuracaoContabil.configuracaoContabilDetalhes.find(
            (item: ConfiguracaoContabilDetalhe) => item.codigoItem === parcela.tipo,
        );

        if (!detalhe) {
            throw new AppError(
                `Detalhe da configuração contábil RD não encontrado para o tipo ${parcela.tipo}`,
                400,
            );
        }

        const contaDebito = detalhe.contaDebitoValorProduto;
        const contaCredito = detalhe.contaCreditoValorProduto;
        const centroCusto = detalhe.centroCusto;
        const centroLucro = detalhe.centroLucro;

        const sufixoTipo = this.getSufixoTipo(parcela.tipo);
        const textoDocumento = configuracaoContabil?.textoHeaderContabil ||
            `Receita dif ${sufixoTipo.toLowerCase()} - período ${parcela.periodoDiferimento}`;

        const tipoArApGl = configuracaoContabil?.tipoContabilERP;
        const tipoDocumento = configuracaoContabil?.tipoDocumentoERP;

        const dataFormatada = this.formatDateOnly(parcela.dataDiferimento);
        const valor = Number(parcela.valorDiferimento);

        const lancamentosContabeis: IntegracaoSAPJson["lancamentosContabeis"] = [];

        if (contaDebito) {
            lancamentosContabeis.push({
                conta: contaDebito,
                centroCusto: centroCusto || "",
                centroLucro: centroLucro || "",
                valor,
            });
        }

        if (contaCredito) {
            lancamentosContabeis.push({
                conta: contaCredito,
                centroCusto: centroCusto || "",
                centroLucro: centroLucro || "",
                valor: valor * -1,
            });
        }

        await s4DotzClient.vendaRecDiferida.update({
            where: { id: vendaRecDiferidaId },
            data: {
                contaCredito: contaCredito || null,
                contaDebito: contaDebito || null,
                centroLucro: centroLucro || null,
                centroCusto: centroCusto || null,
                tipoContabilErp: configuracaoContabil.tipoContabilERP || null,
                tipoDocumentoErp: configuracaoContabil.tipoDocumentoERP || null,
            },
        });

        const numeroDocumento =
            `RD-${parcela.vendasHeaderId}-${String(parcela.periodoDiferimento).padStart(2, "0")}-${sufixoTipo}`;

        return {
            tipoArApGl,
            tipoDocumento,
            codigoCia: cia.ciaIdSAP,
            numeroDocumento: parcela.vendasHeader.numeroDocumentoAnalyzer
                ? `${parcela.vendasHeader.numeroDocumentoAnalyzer}-${String(parcela.periodoDiferimento).padStart(2, "0")}-${sufixoTipo}`
                : numeroDocumento,
            textoDocumento,
            valorDocumento: valor,
            codigoParceiro: parcela.vendasHeader.codigoClienteSAP,
            dataEmissao: dataFormatada,
            dataVencimento: dataFormatada,
            condicaoPagto: "",
            dataLancamento: dataFormatada,
            usuarioLancamento: this.USUARIO_LANCAMENTO_PADRAO,
            lancamentosContabeis,
            anexos: [],
        };
    }

    private async fetchConfiguracaoContabilRD(ciaId: number) {
        return s4DotzClient.configuracaoContabil.findUnique({
            where: { ciaId_tipoProcesso: { ciaId: ciaId, tipoProcesso: "RD" } },
            select: { tipoContabilERP: true, tipoDocumentoERP:true, textoHeaderContabil: true, configuracaoContabilDetalhes: true },
        });
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
