import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import { GerarRelatorioDocumentoService } from "@/modules/documento-fiscal/utils/relatorio/GerarRelatorioDocumentoService";
import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import { serializeDocumentoJsonEnvioSap } from "@/modules/documento-fiscal/utils/documentoJsonEnvioSap";
import { Config } from "@/config/config";
import getDotzStageClient from "@/database/clients/dotzStageClient";

export interface DocumentoFiscalBuildIntegrationJsonParams {
    documentoFiscalHeaderId: number;
    usuarioId: number;
}

interface LancamentoContabil {
    conta: string;
    // Opcionais p/ lançamentos GL puros (Saída XTPG não envia centro de custo/lucro)
    centroCusto?: string;
    centroLucro?: string;
    valor: number;
}

interface Anexo {
    nomeAnexo: string;
    localAnexo: string;
}

export interface IntegracaoSAPJson {
    tipoArApGl: string;
    tipoDocumento: string;
    codigoCia: string;
    numeroDocumento: string;
    textoDocumento: string;
    // Opcionais p/ lançamentos GL puros (Saída XTPG: header sem valor/parceiro/condição)
    valorDocumento?: number;
    codigoParceiro?: string;
    dataEmissao: string;
    dataVencimento: string;
    condicaoPagto?: string;
    dataLancamento: string;
    usuarioLancamento: string;
    lancamentosContabeis: LancamentoContabil[];
    anexos: Anexo[];
}

export class BuildSapIntegration {
    private readonly USUARIO_LANCAMENTO_PADRAO = Config.S4_HANA_CLOUD_USER_NAME;
    private readonly relatorioService = new GerarRelatorioDocumentoService();

    async execute(params: DocumentoFiscalBuildIntegrationJsonParams): Promise<IntegracaoSAPJson[]> {
        const { documentoFiscalHeaderId, usuarioId } = params;

        const documento = await this.fetchDocumento(documentoFiscalHeaderId);

        this.validateDocumento(documento);

        const configuracaoContabil = await this.fetchConfiguracaoContabil(
            documento.ciaId,
            documento.tipoDocumentoERP
        );

        if (!configuracaoContabil) {
            throw new AppError(
                `Configuração contábil não encontrada para CIA ${documento.ciaId} e tipoProcesso ${documento.tipoDocumentoERP}`,
                404
            );
        }

        // DTZ-297 (v3): documentos TP_POS não têm config de ponto no próprio tipo. Para o
        // Relatório de Trocas (#4008), a conta de resgate do ponto vem da config TP_ROM da cia
        // (mesma resolução do backfill: codigo_ponto=U_TIPO senão default). Buscamos essa config
        // só para o SNAPSHOT histórico — os lançamentos contábeis enviados ao SAP continuam
        // saindo da config do próprio tipo do documento (sem alteração).
        const configuracaoContabilPontoSnapshot =
            documento.tipoDocumentoERP === TipoDocumentoERP.TP_POS
                ? await this.fetchConfiguracaoContabil(documento.ciaId, TipoDocumentoERP.TP_ROM)
                : null;

        //No cado de romaneio sempre será o mesmo fornecedor, em POS pode vim mais de um forncedor. Apesar de ter uma trava em tela para escolher o fornecedor matriz.
        const detalhesPorFornecedor = this.agruparDetalhesPorFornecedor(
            documento.documentoFiscalDetalhes,
            documentoFiscalHeaderId
        );

        if (detalhesPorFornecedor.size === 0) {
            throw new AppError(
                "Todos os detalhes do documento já possuem Doc. SAP (codigoDocumentoERP preenchido). Nada a integrar.",
                400
            );
        }

        const integracoesJson: IntegracaoSAPJson[] = [];
        // DTZ-297: acumula as configs de ponto efetivamente aplicadas no cálculo, uma por U_TIPO
        // (dedupe pelo U_TIPO cru do @REFDOTZ), para congelar o histórico usado nesta integração
        // em documento_fiscal_ponto. A chave é o U_TIPO (não o id da config) porque o relatório de
        // Trocas junta por (documento, U_TIPO): dois U_TIPO que caem no mesmo default precisam de
        // uma linha cada, senão um deles ficaria sem conta no relatório.
        const configPontosAplicados = new Map<string, any>();

        for (const [codigoFornecedorSAP, detalhes] of detalhesPorFornecedor.entries()) {
            let relatorio = null;
            if (documento.tipoDocumentoERP === TipoDocumentoERP.TP_POS) {
                relatorio = await this.relatorioService.execute({
                    documentoFiscalHeaderId,
                    codigoFornecedorSAP,
                })
            }

            const mapaContas = new Map<string, Decimal>();
            this.gerarLancamentosContabeis(detalhes, mapaContas);
            const pontosAplicados = await this.gerarLancamentosContabeisCustoPonto(detalhes, mapaContas, configuracaoContabil);
            // DTZ-297 (v3): para TP_POS o snapshot é resolvido pela config TP_ROM da cia usando um
            // mapaContas descartável (não entra nos lançamentos SAP). Demais tipos usam o próprio.
            const pontosParaSnapshot = configuracaoContabilPontoSnapshot
                ? await this.gerarLancamentosContabeisCustoPonto(detalhes, new Map<string, Decimal>(), configuracaoContabilPontoSnapshot)
                : pontosAplicados;
            for (const cp of pontosParaSnapshot) configPontosAplicados.set(cp.uTipo ?? "", cp);

            const lancamentosContabeis = Array.from(mapaContas.entries()).map(([key, valor]) => {
                const [conta, centroCusto, centroLucro] = key.split("|");
                return {
                    conta,
                    centroCusto: centroCusto || "",
                    centroLucro: centroLucro || "",
                    valor: Number(valor.toFixed(2)),
                };
            });

            const valorDocumento = this.calcularValorDocumentoDetalhes(detalhes);

            const integracaoJson = this.montarJson(
                documento,
                configuracaoContabil,
                lancamentosContabeis,
                valorDocumento,
                codigoFornecedorSAP,
                relatorio
            );

            integracoesJson.push(integracaoJson);
        }

        await this.persistirJson(documentoFiscalHeaderId, integracoesJson, usuarioId);

        // DTZ-297: congela as configs de ponto usadas no cálculo desta integração (log histórico).
        await this.persistirSnapshotPonto(documentoFiscalHeaderId, [...configPontosAplicados.values()]);

        return integracoesJson;
    }

    /**
     * DTZ-297: grava em documento_fiscal_ponto o snapshot das linhas de configuração contábil
     * de ponto (configuracao_contabil_detail_ponto) efetivamente aplicadas no cálculo deste
     * documento, para preservar o histórico usado mesmo que a configuração mude depois.
     * Idempotente (reprocesso in-place): apaga o snapshot anterior do documento e regrava.
     * Best-effort: falha aqui não aborta a integração SAP (é log).
     */
    private async persistirSnapshotPonto(documentoFiscalHeaderId: number, configPontos: any[]): Promise<void> {
        try {
            // DTZ-297 (ajuste v2): não apagar o snapshot quando não há ponto a gravar.
            // Documentos TP_POS não têm config de ponto no próprio tipo — o histórico deles
            // vem do backfill (resolvido pela config TP_ROM da cia, semântica do Relatório de
            // Trocas #4008). Um reprocesso com lista vazia NÃO pode apagar esse histórico,
            // senão o relatório volta a ficar sem a conta de resgate desses documentos.
            if (configPontos.length === 0) return;

            await s4DotzClient.documentoFiscalPonto.deleteMany({ where: { documentoFiscalHeaderId } });

            await s4DotzClient.documentoFiscalPonto.createMany({
                data: configPontos.map((cp) => ({
                    documentoFiscalHeaderId,
                    configuracaoContabilHeaderId: cp.configuracaoContabilId,
                    configuracaoContabilDetalhePontoId: cp.id,
                    uTipo: cp.uTipo ?? null,
                    codigoPonto: cp.codigoPonto ?? null,
                    descricaoPonto: cp.descricaoPonto ?? null,
                    custoPonto: cp.custoPonto ?? null,
                    contaCredito: cp.contaCredito ?? null,
                    contaDebito: cp.contaDebito ?? null,
                    grupoPisCofins: cp.grupoPisCofins ?? "N",
                    aliquotaPis: cp.aliquotaPis ?? null,
                    contaCreditoPis: cp.contaCreditoPis ?? null,
                    contaDebitoPis: cp.contaDebitoPis ?? null,
                    aliquotaCofins: cp.aliquotaCofins ?? null,
                    contaCreditoCofins: cp.contaCreditoCofins ?? null,
                    contaDebitoCofins: cp.contaDebitoCofins ?? null,
                })),
            });
            log.info(
                `[BuildSapIntegration] Snapshot de ${configPontos.length} config(s) de ponto gravado (documento=${documentoFiscalHeaderId})`
            );
        } catch (error) {
            log.warn(
                `[BuildSapIntegration] Falha ao gravar snapshot de config de ponto (documento=${documentoFiscalHeaderId}); integração segue: %o`,
                error
            );
        }
    }

    private async fetchDocumento(documentoFiscalHeaderId: number) {
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                id: true,
                ciaId: true,
                codigoDocumento: true,
                tipoDocumentoERP: true,
                tipoContabilERP: true,
                codigoFornecedorSAP: true,
                dataEmissao: true,
                dataLancamentoContabil: true,
                dataVencimento: true,
                romaneioFileName: true,
                status: true,
                cia: {
                    select: {
                        ciaIdSAP: true,
                    },
                },
                documentoFiscalDetalhes: {
                    select: {
                        codigoFornecedorSAP: true,
                        codigoDocumentoERP: true,
                        codigoPedidoParceiro: true,
                        valorPedido: true,
                        valorProduto: true,
                        valorFrete: true,
                        valorCombo: true,
                        valorPisOperacaoCredor: true,
                        valorCofinsOperacaoCredor: true,
                        valorIs: true,
                        valorCbs: true,
                        valorIbsUf: true,
                        valorIbsMunicipal: true,
                        contaContabilCreditoCusto: true,
                        contaContabilDebitoCusto: true,
                        contaContabilCreditoFrete: true,
                        contaContabilDebitoFrete: true,
                        contaContabilCreditoCombo: true,
                        contaContabilDebitoCombo: true,
                        contaContabilCreditoPis: true,
                        contaContabilDebitoPis: true,
                        contaContabilCreditoCofins: true,
                        contaContabilDebitoCofins: true,
                        contaContabilCreditoValorIs: true,
                        contaContabilDebitoValorIs: true,
                        contaContabilCreditoValorCbs: true,
                        contaContabilDebitoValorCbs: true,
                        contaContabilCreditoValorIbsUf: true,
                        contaContabilDebitoValorIbsUf: true,
                        contaContabilCreditoValorIbsMunicipal: true,
                        contaContabilDebitoValorIbsMunicipal: true,
                        centroCusto: true,
                        centroLucro: true,
                        configuracaoContabilDetalhe: {
                            select: {
                                centroCusto: true,
                                centroLucro: true,
                            },
                        },
                    },
                },
            },
        });

        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        return documento;
    }

    private validateDocumento(documento: any) {
        if (documento.status !== StatusDocumento.DIVERGENCIA && documento.status !== StatusDocumento.APROVADO) {
            throw new AppError(
                `Documento deve estar com status DIVERGENCIA para gerar JSON de integração. Status atual: ${documento.status}`,
                400
            );
        }

        if (!documento.cia?.ciaIdSAP) {
            throw new AppError(
                "A CIA associada ao documento não possui ciaIdSAP cadastrado. Configure o ciaIdSAP antes de gerar a integração",
                400
            );
        }

        if (!documento.tipoContabilERP) {
            throw new AppError(
                "Documento não possui tipoContabilERP definido",
                400
            );
        }

        if (!documento.dataVencimento) {
            throw new AppError(
                "Documento não possui data de vencimento definida",
                400
            );
        }

        if (documento.documentoFiscalDetalhes.length === 0) {
            throw new AppError(
                "Documento não possui detalhes para processar",
                400
            );
        }

        const detalhesSemFornecedor = documento.documentoFiscalDetalhes.filter(
            (detalhe: any) => !detalhe.codigoFornecedorSAP
        );

        if (detalhesSemFornecedor.length > 0) {
            throw new AppError(
                `${detalhesSemFornecedor.length} detalhe(s) não possui(em) código de fornecedor SAP definido`,
                400
            );
        }
    }

    private async fetchConfiguracaoContabil(ciaId: number, tipoProcesso: string) {
        return await s4DotzClient.configuracaoContabil.findUnique({
            where: {
                ciaId_tipoProcesso: {
                    ciaId,
                    tipoProcesso,
                },
            },
            select: {
                tipoDocumentoERP: true,
                textoHeaderContabil: true,
                tipoContabilERP: true,
                configuracaoContabilDetalhesPonto: {
                    select: {
                        id: true,
                        ehPadrao: true,
                        configuracaoContabilId: true,
                        codigoPonto: true,
                        descricaoPonto: true,
                        custoPonto: true,
                        contaCredito: true,
                        contaDebito: true,
                        centroCusto: true,
                        grupoPisCofins: true,
                        aliquotaPis: true,
                        aliquotaCofins: true,
                        contaCreditoPis: true,
                        contaDebitoPis: true,
                        contaCreditoCofins: true,
                        contaDebitoCofins: true,
                    },
                },
            },
        });
    }

    private agruparDetalhesPorFornecedor(detalhes: any[], documentoFiscalHeaderId: number): Map<string, any[]> {
        const grupos = new Map<string, any[]>();

        for (const detalhe of detalhes) {
            if (detalhe.codigoDocumentoERP) {
                log.info(
                    `[BuildSapIntegration] Pulando detalhe do fornecedor ${detalhe.codigoFornecedorSAP} — já possui codigoDocumentoERP=${detalhe.codigoDocumentoERP} (documento=${documentoFiscalHeaderId})`
                );
                continue;
            }
            const codigoFornecedor = detalhe.codigoFornecedorSAP!;
            const detalhesDoFornecedor = grupos.get(codigoFornecedor) || [];
            detalhesDoFornecedor.push(detalhe);
            grupos.set(codigoFornecedor, detalhesDoFornecedor);
        }

        return grupos;
    }

    private async gerarLancamentosContabeisCustoPonto(detalhes: any[], mapaContas: Map<string, Decimal>, configuracaoContabil: any): Promise<any[]> {
        // DTZ-297: além de acumular os lançamentos, devolve as configs de ponto aplicadas
        // (para o snapshot histórico em documento_fiscal_ponto).
        const aplicados: any[] = [];
        const codigoPedidosParceiros: number[] = [];
        for (const detalhe of detalhes) {
            const codigoPedidoParceiro = Number(detalhe.codigoPedidoParceiro);
            if (Number.isInteger(codigoPedidoParceiro)) {
                codigoPedidosParceiros.push(codigoPedidoParceiro);
            }
        }

        if (!codigoPedidosParceiros.length) {
            return aplicados;
        }

        const configuracaoContabilDetalhesPonto = configuracaoContabil.configuracaoContabilDetalhesPonto;

        const confDefault = configuracaoContabilDetalhesPonto.find((ccd: any) => ccd.ehPadrao);
        
        // Prisma não escapa @ em nomes de tabela no SQL Server; usa raw query com colchetes
        const ids = codigoPedidosParceiros.join(', ');
        let refdotzItens: { U_TIPO: string | null; U_PONTOS: number }[] = [];
        try {
            refdotzItens = (await getDotzStageClient().$queryRawUnsafe(
                `SELECT U_TIPO, U_PONTOS FROM [@REFDOTZ] WHERE U_PEDCOMPRA IN (${ids})`
            )) as { U_TIPO: string | null; U_PONTOS: number }[];
        } catch (error) {
            log.warn('Não foi possível buscar dados de @REFDOTZ; lançamentos de custo-ponto ignorados: %o', error);
            return aplicados;
        }

        const pontosPorTipoMap = new Map<string | null, number>();
        for (const item of refdotzItens) {
            const tipo = item.U_TIPO ?? null;
            pontosPorTipoMap.set(tipo, (pontosPorTipoMap.get(tipo) ?? 0) + item.U_PONTOS);
        }

        const pontosPorTipo = Array.from(pontosPorTipoMap.entries()).map(([tipo, total]) => ({
            U_TIPO: tipo,
            _sum: { U_PONTOS: total },
        }));

        for (const ponto of pontosPorTipo) {
            const tipo = ponto.U_TIPO;
            const totalPontos = ponto._sum.U_PONTOS || 0;

            const configPonto = configuracaoContabilDetalhesPonto.find((ccd: any) => ccd.codigoPonto === tipo) ?? confDefault;

            if (!configPonto) {
                continue;
            }

            // DTZ-297 (ajuste): carrega o U_TIPO cru junto da config resolvida, para o snapshot
            // registrar o tipo original (o relatório de Trocas junta por documento + U_TIPO).
            aplicados.push({ ...configPonto, uTipo: tipo });

            const valorPonto = new Decimal(totalPontos).mul(configPonto.custoPonto);

            this.acumular(mapaContas, configPonto.contaCredito, this.selCentroCusto(configPonto.contaCredito, configPonto.centroCusto), null, valorPonto, true);
            this.acumular(mapaContas, configPonto.contaDebito, this.selCentroCusto(configPonto.contaDebito, configPonto.centroCusto), null, valorPonto, false);

            if (configPonto.grupoPisCofins === "S") {
                const valorPis = valorPonto.mul(configPonto.aliquotaPis).div(100);
                const valorCofins = valorPonto.mul(configPonto.aliquotaCofins).div(100);

                this.acumular(mapaContas, configPonto.contaCreditoPis, this.selCentroCusto(configPonto.contaCreditoPis, configPonto.centroCusto), null, valorPis, true);
                this.acumular(mapaContas, configPonto.contaDebitoPis, this.selCentroCusto(configPonto.contaDebitoPis, configPonto.centroCusto), null, valorPis, false);

                this.acumular(mapaContas, configPonto.contaCreditoCofins, this.selCentroCusto(configPonto.contaCreditoCofins, configPonto.centroCusto), null, valorCofins, true);
                this.acumular(mapaContas, configPonto.contaDebitoCofins, this.selCentroCusto(configPonto.contaDebitoCofins, configPonto.centroCusto), null, valorCofins, false);
            }

        }

        return aplicados;
    }

    //Aplicar centro de custo apenas para contas de resultado (4), conforme orientação da contabilidade.
    private selCentroCusto(conta: string | null, centroCusto: string | null)  {
        if (!conta || !centroCusto) {
            return null;
        }
        return conta.startsWith("4") ? centroCusto : null;
    };

    private acumular(mapaContas: Map<string, Decimal>, conta: string | null, centroCusto: string | null, centroLucro: string | null, valor: Decimal | null, isCredito: boolean)  {
        if (!conta || !valor || valor.isZero()) {
            return;
        }

        const key = `${conta}|${centroCusto ?? ""}|${centroLucro ?? ""}`;
        const valorNumerico = isCredito ? valor.mul(-1) : valor;
        const acumulado = mapaContas.get(key) || new Decimal(0);
        mapaContas.set(key, acumulado.add(valorNumerico));
    };

    private gerarLancamentosContabeis(detalhes: any[], mapaContas: Map<string, Decimal>) {

        for (const detalhe of detalhes) {
            const configDetalhe = detalhe.configuracaoContabilDetalhe;
            const cc = detalhe.centroCusto ?? configDetalhe?.centroCusto ?? null;
            const cl = detalhe.centroLucro ?? configDetalhe?.centroLucro ?? null;

            // Custos (Produtos): valorPedido para linhas normais, valorProduto para linhas manuais
            const valorCusto = detalhe.valorPedido ?? detalhe.valorProduto;
            this.acumular(mapaContas, detalhe.contaContabilDebitoCusto, cc, cl, valorCusto, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoCusto, cc, cl, valorCusto, true);

            // Frete
            this.acumular(mapaContas, detalhe.contaContabilDebitoFrete, cc, cl, detalhe.valorFrete, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoFrete, cc, cl, detalhe.valorFrete, true);

            // Combo
            this.acumular(mapaContas, detalhe.contaContabilDebitoCombo, cc, cl, detalhe.valorCombo, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoCombo, cc, cl, detalhe.valorCombo, true);

            // PIS
            this.acumular(mapaContas, detalhe.contaContabilDebitoPis, cc, cl, detalhe.valorPisOperacaoCredor, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoPis, cc, cl, detalhe.valorPisOperacaoCredor, true);

            // COFINS
            this.acumular(mapaContas, detalhe.contaContabilDebitoCofins, cc, cl, detalhe.valorCofinsOperacaoCredor, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoCofins, cc, cl, detalhe.valorCofinsOperacaoCredor, true);

            // IS
            this.acumular(mapaContas, detalhe.contaContabilDebitoValorIs, cc, cl, detalhe.valorIs, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoValorIs, cc, cl, detalhe.valorIs, true);

            // CBS
            this.acumular(mapaContas, detalhe.contaContabilDebitoValorCbs, cc, cl, detalhe.valorCbs, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoValorCbs, cc, cl, detalhe.valorCbs, true);

            // IBS UF
            this.acumular(mapaContas, detalhe.contaContabilDebitoValorIbsUf, cc, cl, detalhe.valorIbsUf, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoValorIbsUf, cc, cl, detalhe.valorIbsUf, true);

            // IBS Municipal
            this.acumular(mapaContas, detalhe.contaContabilDebitoValorIbsMunicipal, cc, cl, detalhe.valorIbsMunicipal, false);
            this.acumular(mapaContas, detalhe.contaContabilCreditoValorIbsMunicipal, cc, cl, detalhe.valorIbsMunicipal, true);
        }

    }

    private calcularValorDocumentoDetalhes(detalhes: any[]): number {
        const total = detalhes.reduce((acc, detalhe) => {
            const valor = detalhe.valorPedido ?? detalhe.valorProduto;
            if (valor !== null && valor !== undefined) {
                return acc + Number(valor);
            }
            return acc;
        }, 0);

        return Number(total.toFixed(2));
    }

    private montarJson(
        documento: any,
        configuracaoContabil: any,
        lancamentosContabeis: LancamentoContabil[],
        valorDocumento: number,
        codigoFornecedorSAP: string,
        relatorio: { pdfFilename: string; xlsxFilename: string } | null
    ): IntegracaoSAPJson {
        const apiUrl = Config.API_URL.replace(/\/+$/, "");
        const anexos: Anexo[] = [];

        if (documento.romaneioFileName) {
            anexos.push({
                nomeAnexo: "ROMANEIO",
                localAnexo: `${apiUrl}/files/${encodeURIComponent(documento.romaneioFileName)}`,
            });
        }

        if (relatorio) {
            anexos.push(
                { nomeAnexo: "RELATORIO", localAnexo: `${apiUrl}/files/${encodeURIComponent(relatorio.pdfFilename)}` },
                { nomeAnexo: "RELATORIO_XLSX", localAnexo: `${apiUrl}/files/${encodeURIComponent(relatorio.xlsxFilename)}` },
            );
        }

        const textoDocumento = configuracaoContabil.textoHeaderContabil
            ? configuracaoContabil.textoHeaderContabil
            : `Processo de ${documento.tipoDocumentoERP}`;

        const tipoArApGl = documento.tipoContabilERP;

        const valorDocumentoFinal = tipoArApGl === "AP"
            ? -Math.abs(valorDocumento)
            : valorDocumento;

        return {
            tipoArApGl,
            tipoDocumento: configuracaoContabil.tipoDocumentoERP,
            codigoCia: documento.cia.ciaIdSAP,
            numeroDocumento: documento.codigoDocumento,
            textoDocumento,
            valorDocumento: valorDocumentoFinal,
            codigoParceiro: codigoFornecedorSAP,
            dataEmissao: this.formatDateOnly(documento.dataEmissao),
            dataVencimento: this.formatDateOnly(documento.dataVencimento),
            condicaoPagto: "",
            dataLancamento: this.formatDateOnly(documento.dataLancamentoContabil),
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

    private async persistirJson(
        documentoFiscalHeaderId: number,
        integracoesJson: IntegracaoSAPJson[],
        usuarioId: number
    ) {
        const jsonString = serializeDocumentoJsonEnvioSap(documentoFiscalHeaderId, integracoesJson);

        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoFiscalHeaderId },
            data: {
                documentoJson: jsonString,
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
            },
        });
    }

}
