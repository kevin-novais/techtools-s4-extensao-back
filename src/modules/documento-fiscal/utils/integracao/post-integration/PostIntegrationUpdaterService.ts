import log from "@/util/logger";
import s4DotzClient from "@/database/clients/s4DotzClient";
import getDotzStageClient from "@/database/clients/dotzStageClient";

interface PostIntegrationUpdateParams {
    documentoFiscalHeaderId: number;
    codigoFornecedorSAP: string;
    numeroDocumentoERP: string;
}

export class PostIntegrationUpdaterService {
    async execute(params: PostIntegrationUpdateParams): Promise<void> {
        const { documentoFiscalHeaderId, codigoFornecedorSAP, numeroDocumentoERP } = params;

        if (!numeroDocumentoERP) {
            log.warn("[PostIntegrationUpdater] numeroDocumentoERP vazio, ignorando atualização pós-integração");
            return;
        }

        if (!codigoFornecedorSAP) {
            log.warn("[PostIntegrationUpdater] codigoFornecedorSAP vazio, ignorando atualização pós-integração");
            return;
        }

        const detalhes = await s4DotzClient.documentoFiscalDetalhe.findMany({
            where: {
                documentoFiscalHeaderId,
                codigoFornecedorSAP,
            },
            select: {
                id: true,
                codigoPedidoParceiro: true,
            },
        });

        if (detalhes.length === 0) {
            log.warn(
                `[PostIntegrationUpdater] Nenhum detalhe encontrado para documento ${documentoFiscalHeaderId} e fornecedor ${codigoFornecedorSAP}`
            );
            return;
        }

        await this.atualizarCodigoDocumentoERP(documentoFiscalHeaderId, codigoFornecedorSAP, numeroDocumentoERP);

        const pedidosParceiro = this.extrairPedidosParceiro(detalhes);

        if (pedidosParceiro.length === 0) {
            log.warn(
                `[PostIntegrationUpdater] Nenhum codigoPedidoParceiro encontrado para documento ${documentoFiscalHeaderId} e fornecedor ${codigoFornecedorSAP}`
            );
            return;
        }

        const pedidosNumericos = this.converterPedidosParaNumero(pedidosParceiro);

        if (pedidosNumericos.length === 0) {
            log.warn(
                `[PostIntegrationUpdater] Nenhum codigoPedidoParceiro numérico para documento ${documentoFiscalHeaderId} e fornecedor ${codigoFornecedorSAP}`
            );
            return;
        }

        const dotzStageClient = getDotzStageClient();

        await this.atualizarPedidosOPOR(dotzStageClient, pedidosNumericos, documentoFiscalHeaderId, codigoFornecedorSAP);
        await this.atualizarItensPOR1(
            dotzStageClient,
            pedidosNumericos,
            documentoFiscalHeaderId,
            codigoFornecedorSAP,
            numeroDocumentoERP
        );
    }

    private async atualizarCodigoDocumentoERP(
        documentoFiscalHeaderId: number,
        codigoFornecedorSAP: string,
        numeroDocumentoERP: string
    ): Promise<void> {
        try {
            const resultado = await s4DotzClient.documentoFiscalDetalhe.updateMany({
                where: {
                    documentoFiscalHeaderId,
                    codigoFornecedorSAP,
                },
                data: {
                    codigoDocumentoERP: numeroDocumentoERP,
                },
            });

            log.info(
                `[PostIntegrationUpdater] Atualizados ${resultado.count} detalhes com codigoDocumentoERP=${numeroDocumentoERP} (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP})`
            );
        } catch (error) {
            log.error(
                `[PostIntegrationUpdater] Erro ao atualizar codigoDocumentoERP nos detalhes (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP}):`,
                error
            );
        }
    }

    private extrairPedidosParceiro(detalhes: { codigoPedidoParceiro: string | null }[]): string[] {
        const pedidos = detalhes
            .map(detalhe => detalhe.codigoPedidoParceiro)
            .filter((pedido): pedido is string => pedido !== null);

        return Array.from(new Set(pedidos));
    }

    private converterPedidosParaNumero(pedidosParceiro: string[]): number[] {
        return pedidosParceiro
            .map(Number)
            .filter(numero => Number.isInteger(numero));
    }

    private async atualizarPedidosOPOR(
        dotzStageClient: any,
        pedidosNumericos: number[],
        documentoFiscalHeaderId: number,
        codigoFornecedorSAP: string
    ): Promise<void> {
        try {
            const resultado = await dotzStageClient.oPOR.updateMany({
                where: {
                    U_DOTZNRPED: {
                        in: pedidosNumericos,
                    },
                },
                data: {
                    DocStatus: "C",
                },
            });

            log.info(
                `[PostIntegrationUpdater] OPOR atualizados: ${resultado.count} registros (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP})`
            );
        } catch (error) {
            log.error(
                `[PostIntegrationUpdater] Erro ao atualizar OPOR (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP}):`,
                error
            );
        }
    }

    private async atualizarItensPOR1(
        dotzStageClient: any,
        pedidosNumericos: number[],
        documentoFiscalHeaderId: number,
        codigoFornecedorSAP: string,
        numeroDocumentoERP: string
    ): Promise<void> {
        const opors = await dotzStageClient.oPOR.findMany({
            where: {
                U_DOTZNRPED: {
                    in: pedidosNumericos,
                },
            },
            select: {
                DocEntry: true,
            },
        });

        if (opors.length === 0) {
            log.warn(
                `[PostIntegrationUpdater] Nenhum OPOR encontrado para atualizar POR1 (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP})`
            );
            return;
        }

        const docEntries = opors.map((opor: { DocEntry: number }) => opor.DocEntry);

        const numeroDocumentoERPBigInt = BigInt(numeroDocumentoERP);

        const resultado = await dotzStageClient.pOR1.updateMany({
            where: {
                DocEntry: {
                    in: docEntries,
                },
            },
            data: {
                LineStatus: "C",
                U_DocEntryNF: numeroDocumentoERPBigInt,
            },
        });

        log.info(
            `[PostIntegrationUpdater] POR1 atualizados: ${resultado.count} registros (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP}, numeroDocumentoERP=${numeroDocumentoERPBigInt})`
        );
    }
}

