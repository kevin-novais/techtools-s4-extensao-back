import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { formatDateOnly } from "@/util/date";

interface GerarParcelasParams {
    vendasHeaderId: number;
}

type TipoVendaRecDiferida = "DIFERIDO_TOTAL" | "DIFERIDO_VENDA";

interface ParcelaCriada {
    id: number;
    periodoDiferimento: number;
    tipo: TipoVendaRecDiferida;
    dataDiferimento: string | null;
    valorDiferimento: string | null;
    status: string;
    criada: boolean;
}

interface GerarParcelasResult {
    vendasHeaderId: number;
    totalParcelas: number;
    parcelas: ParcelaCriada[];
}

interface GerarParcelasDiferidasParams {
    vendasHeaderId: number;
    numeroParcelas: number;
    dataEmissao: Date;
    valorTotalDiferido: number;
    valorParcela: number;
    tipo: TipoVendaRecDiferida;
    configuracaoRd: {
        tipoContabilERP: string;
    };
    detalhe: {
        contaCreditoValorProduto: string | null;
        contaDebitoValorProduto: string | null;
        centroLucro: string | null;
        centroCusto: string | null;
    } | null;
}

export class VendaRecDiferidaGerarParcelasService {
    async execute(params: GerarParcelasParams): Promise<GerarParcelasResult> {
        const { vendasHeaderId } = params;

        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: {
                id: true,
                ciaIdSAP: true,
                status: true,
                codigoClienteSAP: true,
                valorTotalVendas: true,
                dataEmissao: true,
                periodoDeDiferimento: true,
                taxaExpiracao: true,
                valorReceitaVenda: true,
            },
        });

        if (!venda) throw new AppError("Venda não encontrada", 404);

        if (!venda.valorTotalVendas) throw new AppError("Venda não possui valor total definido", 400);

        if (!venda.dataEmissao) throw new AppError("Venda não possui data de emissão definida", 400);

        const cia = await s4DotzClient.cia.findFirst({
            where: { ciaIdSAP: venda.ciaIdSAP, deletadoEm: null },
            select: { id: true },
        });

        if (!cia) throw new AppError(`CIA com ciaIdSAP ${venda.ciaIdSAP} não encontrada`, 400);

        const configuracaoDr = await s4DotzClient.configuracaoContabil.findUnique({
            where: { ciaId_tipoProcesso: { ciaId: cia.id, tipoProcesso: "DR" } },
            select: { periodoDeDiferimento: true, taxaExpiracao: true },
        });

        const numeroParcelas = venda.periodoDeDiferimento ?? configuracaoDr?.periodoDeDiferimento ?? null;
        const taxaExpiracao = venda.taxaExpiracao ?? configuracaoDr?.taxaExpiracao ?? null;

        if (
            configuracaoDr &&
            (venda.periodoDeDiferimento === null || venda.taxaExpiracao === null)
        ) {
            await s4DotzClient.vendasHeader.update({
                where: { id: vendasHeaderId },
                data: {
                    ...(venda.periodoDeDiferimento === null
                        ? { periodoDeDiferimento: configuracaoDr.periodoDeDiferimento }
                        : {}),
                    ...(venda.taxaExpiracao === null
                        ? { taxaExpiracao: configuracaoDr.taxaExpiracao }
                        : {}),
                    atualizadoEm: new Date(),
                },
            });
        }

        if (!numeroParcelas) {
            log.info(
                `[VendaRecDiferidaGerarParcelas] Configuração DR inexistente ou periodoDeDiferimento nulo/zero para CIA ${cia.id}. Venda ${vendasHeaderId} não gera diferidas.`,
            );
            return { vendasHeaderId, totalParcelas: 0, parcelas: [] };
        }

        if (!taxaExpiracao) {
            log.info(
                `[VendaRecDiferidaGerarParcelas] Configuração DR inexistente ou taxaExpiracao nula/zero para CIA ${cia.id}. Venda ${vendasHeaderId} não gera diferidas.`,
            );
            return { vendasHeaderId, totalParcelas: 0, parcelas: [] };
        }

        const configuracaoRd = await s4DotzClient.configuracaoContabil.findUnique({
            where: { ciaId_tipoProcesso: { ciaId: cia.id, tipoProcesso: "RD" } },
            select: {
                id: true,
                tipoContabilERP: true,
                textoHeaderContabil: true,
                configuracaoContabilDetalhes: {
                    take: 1,
                    select: {
                        contaCreditoValorProduto: true,
                        contaDebitoValorProduto: true,
                        centroCusto: true,
                        centroLucro: true,
                    },
                },
            },
        });

        if (!configuracaoRd) {
            log.info(
                `[VendaRecDiferidaGerarParcelas] Nenhuma configuração contábil RD para CIA ${cia.id}. Venda ${vendasHeaderId} não gera diferidas.`,
            );
            return { vendasHeaderId, totalParcelas: 0, parcelas: [] };
        }

        const detalhe = configuracaoRd.configuracaoContabilDetalhes[0] ?? null;

        const valorTotal = Number(venda.valorTotalVendas);
        const percentualExpiracao = Number(taxaExpiracao) / 100;
        const valorTotalDiferido = Number((valorTotal * percentualExpiracao).toFixed(2));
        const valorParcelaTotal = Number((valorTotalDiferido / numeroParcelas).toFixed(2));
        const valorReceitaVenda = Number(venda.valorReceitaVenda ?? 0);
        const valorParcelaVenda = Number((valorReceitaVenda / numeroParcelas).toFixed(2));
        console.log(`[VendaRecDiferidaGerarParcelas] Venda ${vendasHeaderId}: valorTotal=${valorTotal}, percentualExpiracao=${percentualExpiracao}, valorTotalDiferido=${valorTotalDiferido}, valorParcela=${valorParcelaTotal}`);

        const parcelasDiferidoTotal = await this.gerarParcelasDiferidas({
            vendasHeaderId,
            numeroParcelas,
            dataEmissao: venda.dataEmissao,
            valorTotalDiferido,
            valorParcela: valorParcelaTotal,
            tipo: "DIFERIDO_TOTAL",
            configuracaoRd,
            detalhe,
        });

        const parcelasDiferidoVenda = await this.gerarParcelasDiferidas({
                vendasHeaderId,
                numeroParcelas,
                dataEmissao: venda.dataEmissao,
                valorTotalDiferido: valorReceitaVenda,
                valorParcela: valorParcelaVenda,
                tipo: "DIFERIDO_VENDA",
                configuracaoRd,
                detalhe,
            });

        const parcelas = parcelasDiferidoTotal.concat(parcelasDiferidoVenda);

        log.info(
            `[VendaRecDiferidaGerarParcelas] Venda ${vendasHeaderId}: ${parcelas.filter(p => p.criada).length} parcelas criadas, ${parcelas.filter(p => !p.criada).length} já existiam`,
        );

        return { vendasHeaderId, totalParcelas: numeroParcelas, parcelas };
    }

    private async gerarParcelasDiferidas({
        vendasHeaderId,
        numeroParcelas,
        dataEmissao,
        valorTotalDiferido,
        valorParcela,
        tipo,
    }: GerarParcelasDiferidasParams): Promise<ParcelaCriada[]> {
        const parcelas: ParcelaCriada[] = [];

        for (let periodo = 1; periodo <= numeroParcelas; periodo++) {
            const dataDiferimento = this.calcularDataDiferimento(dataEmissao, periodo);

            // Último período absorve diferença de arredondamento
            const valor =
                periodo === numeroParcelas
                    ? Number((valorTotalDiferido - valorParcela * (numeroParcelas - 1)).toFixed(2))
                    : valorParcela;

            try {
                const existente = await s4DotzClient.vendaRecDiferida.findUnique({
                    where: {
                        vendasHeaderId_periodoDiferimento_tipo: {
                            vendasHeaderId,
                            periodoDiferimento: periodo,
                            tipo,
                        },
                    },
                    select: { id: true, status: true },
                });

                if (existente) {
                    parcelas.push({
                        id: existente.id,
                        periodoDiferimento: periodo,
                        tipo,
                        dataDiferimento: formatDateOnly(dataDiferimento),
                        valorDiferimento: String(valor),
                        status: existente.status,
                        criada: false,
                    });
                    continue;
                }

                const nova = await s4DotzClient.vendaRecDiferida.create({
                    data: {
                        vendasHeaderId,
                        periodoDiferimento: periodo,
                        tipo,
                        status: "PENDENTE",
                        dataEmissao,
                        dataDiferimento,
                        valorDiferimento: valor,
                        ano: dataEmissao.getUTCFullYear(),
                    },
                    select: { id: true, status: true },
                });

                parcelas.push({
                    id: nova.id,
                    periodoDiferimento: periodo,
                    tipo,
                    dataDiferimento: formatDateOnly(dataDiferimento),
                    valorDiferimento: String(valor),
                    status: nova.status,
                    criada: true,
                });
            } catch (error: any) {
                // Conflito de unique constraint (race condition) — a parcela já existe
                if (error?.code === "P2002") {
                    log.warn(
                        `[VendaRecDiferidaGerarParcelas] Parcela ${periodo} da venda ${vendasHeaderId} já existe (race condition)`,
                    );
                    continue;
                }
                throw error;
            }
        }

        return parcelas;
    }

    /**
     * Calcula a data de diferimento: 1º dia do mês seguinte ao de emissão + (periodo - 1) meses.
     * Ex: emissão 2026-01-15, periodo 1 → 2026-02-01; periodo 2 → 2026-03-01.
     */
    private calcularDataDiferimento(dataEmissao: Date, periodo: number): Date {
        const ano = dataEmissao.getUTCFullYear();
        const mes = dataEmissao.getUTCMonth(); // 0-based
        // Primeiro dia do mês seguinte
        const primeiroMesSeguinte = new Date(Date.UTC(ano, mes + 1, 1));
        // Avança (periodo - 1) meses
        primeiroMesSeguinte.setUTCMonth(primeiroMesSeguinte.getUTCMonth() + (periodo - 1));
        return primeiroMesSeguinte;
    }
}
