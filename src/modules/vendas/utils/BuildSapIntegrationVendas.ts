import { Config } from "@/config/config";
import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { buildPublicFileUrl } from "@/util/file-url";
import { Prisma } from "@prisma/client-s4-dotz";
import { Decimal } from "@prisma/client-s4-dotz/runtime/library";

export interface VendasBuildIntegrationJsonParams {
    vendasHeaderId: number;
}

interface LancamentoContabil {
    conta: string;
    centroCusto: string;
    centroLucro: string;
    valor: number;
}

interface Anexo {
    nomeAnexo: string;
    localAnexo: string;
}

interface ReceitasCalculadas {
    valorReceitaExpiracao: Decimal;
    valorReceitaVenda: Decimal;
    valorReceitaResgate: Decimal;
}

interface LancamentosContabeisResult {
    lancamentosContabeis: LancamentoContabil[];
    receitasCalculadas: ReceitasCalculadas;
}

const configuracaoContabilVendasSelect = Prisma.validator<Prisma.ConfiguracaoContabilSelect>()({
    id: true,
    textoHeaderContabil: true,
    tipoContabilERP: true,
    periodoDeDiferimento: true,
    taxaExpiracao: true,
    tipoProcesso: true,
    configuracaoContabilDetalhesPonto: {
        select: {
            id: true,
            ehPadrao: true,
            configuracaoContabilId: true,
            codigoPonto: true,
            custoPonto: true,
            centroCusto: true,
            centroLucro: true,
            contaCreditoReceitaExpiracao: true,
            contaCreditoReceitaVendas: true,
            contaCreditoReceitaResgate: true,
            grupoPisCofins: true,
            aliquotaPis: true,
            aliquotaCofins: true,
            contaCreditoPis: true,
            contaDebitoPis: true,
            contaCreditoCofins: true,
            contaDebitoCofins: true,
        },
    },
});

type ConfiguracaoContabilVendas = Prisma.ConfiguracaoContabilGetPayload<{
    select: typeof configuracaoContabilVendasSelect;
}>;

export interface IntegracaoSAPJson {
    tipoArApGl: string;
    tipoDocumento: string;
    codigoCia: string;
    numeroDocumento: string;
    textoDocumento: string;
    valorDocumento: number;
    codigoParceiro: string;
    dataEmissao: string;
    dataVencimento: string;
    condicaoPagto: string;
    dataLancamento: string;
    usuarioLancamento: string;
    lancamentosContabeis: LancamentoContabil[];
    anexos: Anexo[];
}

export class BuildSapIntegrationVendas {
    private readonly USUARIO_LANCAMENTO_PADRAO = Config.S4_HANA_CLOUD_USER_NAME;

    async execute(params: VendasBuildIntegrationJsonParams): Promise<IntegracaoSAPJson[]> {
        const { vendasHeaderId } = params;

        const venda = await this.fetchVenda(vendasHeaderId);

        this.validateVenda(venda);

        // ciaId no VendasHeader é o ciaIdSAP — buscar a CIA pelo código SAP
        const cia = await this.fetchCiaByCiaIdSAP(venda.ciaIdSAP);

        if (!cia?.ciaIdSAP) {
            throw new AppError(
                `CIA com ciaIdSAP ${venda.ciaIdSAP} não encontrada. Verifique o cadastro da CIA`,
                400,
            );
        }

        const configuracaoContabil = await this.fetchConfiguracaoContabil(cia.id);

        if (!configuracaoContabil) {
            throw new AppError(
                `Configuração contábil não encontrada para CIA ${cia.id} e tipoProcesso DR`,
                404,
            );
        }

        // Gerar lançamentos contábeis
        const { lancamentosContabeis, receitasCalculadas } = this.gerarLancamentosContabeis(
            venda.vendasDetalhe,
            // configDetalhes,
            configuracaoContabil,
        );

        // Calcular valor total do documento
        const valorDocumento = this.calcularValorDocumento(venda);

        const clienteSAP = await this.fetchClienteSapByCodigoClienteAnalyzer(
            venda.codigoClienteAnalyzer,
            venda.cnpjCliente
        );

        if (!clienteSAP?.CardCode) {
            throw new AppError(
                `Cliente SAP não encontrado na OCRD para U_CODDOTZ (código analyzer: ${venda.codigoClienteAnalyzer}, CNPJ: ${venda.cnpjCliente})`,
                404,
            );
        }

        // Montar JSON de integração — usar ciaIdSAP da CIA encontrada
        const integracaoJson = this.montarJson(
            venda,
            configuracaoContabil,
            lancamentosContabeis,
            valorDocumento,
            cia.ciaIdSAP,
            clienteSAP.CardCode,
        );

        // Persistir JSON no banco
        await this.persistirVendasHeader(
            vendasHeaderId,
            [integracaoJson],
            configuracaoContabil.periodoDeDiferimento ?? null,
            configuracaoContabil.taxaExpiracao ?? null,
            configuracaoContabil.tipoContabilERP ?? null,
            configuracaoContabil.tipoProcesso ?? null,
            receitasCalculadas,
            venda.dataEmissao.getUTCFullYear(),
            new Decimal(valorDocumento),
            clienteSAP.CardCode
        );

        return [integracaoJson];
    }

    private async fetchVenda(vendasHeaderId: number) {
        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: {
                id: true,
                ciaIdSAP: true,
                status: true,
                codigoClienteAnalyzer: true,
                cnpjCliente: true,
                codigoClienteSAP: true,
                numeroDocumentoAnalyzer: true,
                infoReferenciaAnalyzer: true,
                valorTotalVendas: true,
                pathArquivoFaturaDetalhadaAnalyzer: true,
                pathArquivoRelatorioAnalitico: true,
                dataEmissao: true,
                dataLancamentoContabil: true,
                dataVencimento: true,
                vendasDetalhe: {
                    select: {
                        id: true,
                        itemDocumento: true,
                        codigoProdutoDotz: true,
                        centroLucro: true,
                        quantidadePontos: true,
                        valorVenda: true,
                        precoUnitario: true,
                        custoPontos: true,
                    },
                },
            },
        });

        if (!venda) {
            throw new AppError("Venda não encontrada", 404);
        }

        return venda;
    }

    private async fetchCiaByCiaIdSAP(ciaId: string) {
        const cia = await s4DotzClient.cia.findFirst({
            where: {
                ciaIdSAP: ciaId,
                deletadoEm: null,
            },
            select: {
                id: true,
                ciaIdSAP: true,
            },
        });

        return cia;
    }

    private validateVenda(venda: any): void {
        if (!venda.codigoClienteAnalyzer) {
            throw new AppError("Venda não possui código de cliente Analyzer definido", 400);
        }

        if (venda.vendasDetalhe.length === 0) {
            throw new AppError("Venda não possui detalhes para processar", 400);
        }
    }

    private async fetchConfiguracaoContabil(ciaId: number) {
        return s4DotzClient.configuracaoContabil.findUnique({
            where: {
                ciaId_tipoProcesso: {
                    ciaId,
                    tipoProcesso: "DR",
                },
            },
            select: configuracaoContabilVendasSelect,
        });
    }

    // private async fetchConfiguracaoContabilDetalhes(configuracaoContabilId: number) {
    //     return s4DotzClient.configuracaoContabilDetalhe.findMany({
    //         where: { configuracaoContabilId },
    //         select: {
    //             codigoItem: true,
    //             contaCreditoValorProduto: true,
    //             contaDebitoValorProduto: true,
    //             centroCusto: true,
    //             centroLucro: true,
    //             contaCreditoReceitaExpiracao: true,
    //             contaCreditoReceitaVendas: true,
    //             contaCreditoReceitaResgate: true,
    //         },
    //     });
    // }

    public async fetchClienteSapByCodigoClienteAnalyzer(codigoClienteAnalyzer: string, cnpj:string) {
        const codigoDotz = Number(codigoClienteAnalyzer.trim());

        if (!Number.isInteger(codigoDotz)) {
            throw new AppError(
                `Código de cliente Analyzer inválido para busca na OCRD: ${codigoClienteAnalyzer}`,
                400,
            );
        }

        if (!cnpj ||!cnpj?.trim()) {
            throw new AppError("Venda não possui CNPJ do cliente definido", 400);
        }

        return dotzStageClient().oCRD.findFirst({
            select: {
                CardCode: true,
            },
            where: {
                U_CODDOTZ: codigoDotz,
                cnpj: cnpj,
                ativo: true,
            },
            orderBy: {
                UpdateDate: "desc",
            },
        });
    }

    private gerarLancamentosContabeis(
        detalhes: any[],
        configuracaoContabil: ConfiguracaoContabilVendas,
    ): LancamentosContabeisResult {
        
        let configPadraoPonto = configuracaoContabil.configuracaoContabilDetalhesPonto[0];
        // Criar mapa de config por código de produto para lookup
        const mapConfigPorPonto = new Map<string, any>();
        for (const config of configuracaoContabil.configuracaoContabilDetalhesPonto) {
            if (config.ehPadrao) {
                configPadraoPonto = config;
            }
            if (config.codigoPonto) {
                mapConfigPorPonto.set(config.codigoPonto, config);
            }
        }

        const mapaItensLancamento = new Map<string, Decimal>();
        // Vendas (AR): todos os lançamentos são positivos (diferente de Trocas/AP que usa crédito negativo)
        // centroCusto sempre vazio para Vendas — apenas centroLucro é usado
        const acumular = (
            conta: string | null,
            centroLucro: string | null,
            centroCusto: string | null,
            valor: Decimal | null,
        ) => {
            if (!conta || !valor || Number(valor) === 0) {
                return;
            }

            const key = `${conta}|${centroLucro ?? ""}|${centroCusto ?? ""}`;
            const acumulado = mapaItensLancamento.get(key) || new Decimal(0);
            mapaItensLancamento.set(key, acumulado.add(valor));
        };

        let somaValorProdutos = new Decimal(0);
        let somaQtnPontos = new Decimal(0);

        let somaValorReceitaExpiracao = new Decimal(0);
        let somaValorReceitaVenda = new Decimal(0);
        let somaValorReceitaResgate = new Decimal(0);

        for (const detalheVenda of detalhes) {
            // Buscar config específica pelo código do produto ou usar padrão
            const config = (detalheVenda.codigoProdutoDotz && mapConfigPorPonto.get(detalheVenda.codigoProdutoDotz))
                || configPadraoPonto;

            if (!config) {
                throw new AppError(`[BuildSapIntegrationVendas] Nenhuma configuração contábil encontrada para ponto ${detalheVenda.codigoProdutoDotz}`,
                404,
                );
            }

            const valorVendaItem: Decimal = detalheVenda.valorVenda ? new Decimal(detalheVenda.valorVenda) : new Decimal(detalheVenda.precoUnitario).mul(detalheVenda.quantidadePontos).toDecimalPlaces(2);
            
            somaValorProdutos = somaValorProdutos.add(valorVendaItem);
            const qtnPontos = new Decimal(detalheVenda.quantidadePontos ?? 0);
            somaQtnPontos = somaQtnPontos.add(qtnPontos);
            
            const cl = detalheVenda.centroLucro ?? config.centroLucro ?? null;
            const cc = config.centroCusto ?? null;

            // Calcula Receitas de Venda
            const pontosExpirados = qtnPontos.mul(configuracaoContabil.taxaExpiracao!).div(100).toDecimalPlaces(0);
            const valorReceitaExpiracao = pontosExpirados.mul(detalheVenda.precoUnitario!).toDecimalPlaces(2);
            somaValorReceitaExpiracao = somaValorReceitaExpiracao.add(valorReceitaExpiracao)
            acumular(config.contaCreditoReceitaExpiracao, cl, cc, valorReceitaExpiracao.mul(-1));

            const pontosVenda = qtnPontos.minus(pontosExpirados);
            const custoPontos = detalheVenda.custoPontos ?? config.custoPonto;
            if (!custoPontos) {
                throw new AppError(
                    `[BuildSapIntegrationVendas] Nenhum custo de ponto definido para ponto ${detalheVenda.codigoProdutoDotz}`
                );
            }

            const valorReceitaVenda = pontosVenda.mul(detalheVenda.precoUnitario!.minus(custoPontos)).toDecimalPlaces(2);
            somaValorReceitaVenda = somaValorReceitaVenda.add(valorReceitaVenda)
            acumular(config.contaCreditoReceitaVendas, cl, cc,  valorReceitaVenda.mul(-1));

            let valorReceitaResgate = valorVendaItem.minus(valorReceitaVenda).minus(valorReceitaExpiracao).toDecimalPlaces(2);
            //Retira diferença com o valor total do item.
            const dif = valorVendaItem.minus(valorReceitaVenda).minus(valorReceitaExpiracao).minus(valorReceitaResgate).toDecimalPlaces(2);
            valorReceitaResgate = valorReceitaResgate.add(dif);

            somaValorReceitaResgate = somaValorReceitaResgate.add(valorReceitaResgate)
            acumular(config.contaCreditoReceitaResgate, cl, cc, valorReceitaResgate.mul(-1));

            if (config.grupoPisCofins === "S") {
                const valorPis = valorVendaItem.mul(config.aliquotaPis).div(100).toDecimalPlaces(2);
                const valorCofins = valorVendaItem.mul(config.aliquotaCofins).div(100).toDecimalPlaces(2);

                acumular(config.contaCreditoPis, cl, cc, valorPis.mul(-1));
                acumular(config.contaDebitoPis, cl, cc, valorPis);
                acumular(config.contaCreditoCofins, cl, cc, valorCofins.mul(-1));
                acumular(config.contaDebitoCofins, cl, cc, valorCofins);
            }

            //TODO: salvar histórico de pis cofins na tabela de vendasDetalhe
        }

        const lancamentosContabeis = Array.from(mapaItensLancamento.entries()).map(([key, valor]) => {
            const [conta, centroLucro, centroCusto] = key.split("|");
            return {
                conta,
                centroCusto: centroCusto || "",
                centroLucro: centroLucro || "",
                valor: Number(valor),
            };
        });

        return {
            lancamentosContabeis,
            receitasCalculadas: {
                valorReceitaExpiracao : somaValorReceitaExpiracao,
                valorReceitaVenda : somaValorReceitaVenda,
                valorReceitaResgate : somaValorReceitaResgate,
            },
        };
    }

    private calcularValorDocumento(venda: any): number {
        const total = venda.vendasDetalhe.reduce((acc: number, detalhe: any) => {
            if (detalhe.valorVenda) {
                return acc + Number(new Decimal(detalhe.valorVenda));
            }
            if (detalhe.precoUnitario && detalhe.quantidadePontos) {
                return acc + Number(new Decimal(detalhe.precoUnitario).mul(detalhe.quantidadePontos).toDecimalPlaces(2));
            }
            return acc;
        }, 0);

        return Number(total);
    }

    private montarJson(
        venda: any,
        configuracaoContabil: any,
        lancamentosContabeis: LancamentoContabil[],
        valorDocumento: number,
        ciaIdSAP: string,
        codigoParceiro: string,
    ): IntegracaoSAPJson {
        const anexos: Anexo[] = [];

        // Anexar arquivos do analyzer se existirem
        if (venda.pathArquivoFaturaDetalhadaAnalyzer) {
            const publicUrl = buildPublicFileUrl(venda.pathArquivoFaturaDetalhadaAnalyzer);
            if (publicUrl) {
                anexos.push({
                    nomeAnexo: "FATURA_DETALHADA",
                    localAnexo: publicUrl,
                });
            }
        }

        if (venda.pathArquivoRelatorioAnalitico) {
            const publicUrl = buildPublicFileUrl(venda.pathArquivoRelatorioAnalitico);
            if (publicUrl) {
                anexos.push({
                    nomeAnexo: "RELATORIO_ANALITICO",
                    localAnexo: publicUrl,
                });
            }
        }

        const textoDocumento = configuracaoContabil.textoHeaderContabil
            || "Lançamento contábil - Venda de pontos";


        return {
            tipoArApGl: configuracaoContabil.tipoContabilERP,
            tipoDocumento: configuracaoContabil.tipoProcesso,
            codigoCia: ciaIdSAP,
            numeroDocumento: venda.numeroDocumentoAnalyzer || `DR-${venda.id}`,
            textoDocumento,
            valorDocumento,
            codigoParceiro,
            dataEmissao: this.formatDateOnly(venda.dataEmissao),
            dataVencimento: venda.dataVencimento
                ? this.formatDateOnly(venda.dataVencimento)
                : "",
            condicaoPagto: "",
            dataLancamento: this.formatDateOnly(venda.dataLancamentoContabil || venda.dataEmissao),
            usuarioLancamento: this.USUARIO_LANCAMENTO_PADRAO,
            lancamentosContabeis,
            anexos,
        };
    }

    private formatDateOnly(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private async persistirVendasHeader(
        vendasHeaderId: number,
        integracoesJson: IntegracaoSAPJson[],
        periodoDeDiferimento: number | null,
        taxaExpiracao: Decimal | null,
        tipoContabilERP: string | null,
        tipoProcesso: string | null,
        receitasCalculadas: ReceitasCalculadas,
        ano:number, 
        valorTotalVendas:Decimal,
        codigoClienteSAP: string | null = null
    ): Promise<void> {
        const jsonString = JSON.stringify(integracoesJson, null, 2);

        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                documentoJson: jsonString,
                valorTotalVendas,
                tipoContabilERP,
                tipoProcesso,
                periodoDeDiferimento,
                taxaExpiracao,
                valorReceitaExpiracao: receitasCalculadas.valorReceitaExpiracao,
                valorReceitaVenda: receitasCalculadas.valorReceitaVenda,
                valorReceitaResgate: receitasCalculadas.valorReceitaResgate,
                ano: ano,
                atualizadoEm: new Date(),
                codigoClienteSAP,
            },
        });
    }
}
