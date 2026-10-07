import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { TipoErro } from "@/@types/DocumentoFiscalError/TipoErroTypes";

interface DocumentoDetalheShowResponse {
    id: number;
    documentoFiscalHeaderId: number;
    codigoDocumento: string;
    itemDocumento: number | null;
    codigoProdutoDotz: string | null;
    codigoProdutoFornecedor: string | null;
    quantidadeProduto: number | null;
    descricaoProduto: string | null;
    valorProduto: string | null;
    valorPedido: string | null;
    valorFrete: string | null;
    valorCombo: string | null;
    codigoPedidoParceiro: string | null;
    codigoPedidoAnalyzer: string | null;
    codigoDocumentoERP: string | null;
    divergencias: boolean;
    grupoPisCofins: string | null;
    configuracaoContabilDetalheId: number | null;
    // Contas contábeis
    contaContabilCreditoCusto: string | null;
    contaContabilDebitoCusto: string | null;
    contaContabilCreditoFrete: string | null;
    contaContabilDebitoFrete: string | null;
    contaContabilCreditoCombo: string | null;
    contaContabilDebitoCombo: string | null;
    contaContabilCreditoPis: string | null;
    contaContabilDebitoPis: string | null;
    contaContabilCreditoCofins: string | null;
    contaContabilDebitoCofins: string | null;
    contaContabilCreditoValorIs: string | null;
    contaContabilDebitoValorIs: string | null;
    contaContabilCreditoValorCbs: string | null;
    contaContabilDebitoValorCbs: string | null;
    contaContabilCreditoValorIbsUf: string | null;
    contaContabilDebitoValorIbsUf: string | null;
    contaContabilCreditoValorIbsMunicipal: string | null;
    contaContabilDebitoValorIbsMunicipal: string | null;
    // Valores calculados
    valorPisOperacaoCredor: string | null;
    valorCofinsOperacaoCredor: string | null;
    valorIs: string | null;
    valorCbs: string | null;
    valorIbsUf: string | null;
    valorIbsMunicipal: string | null;
    // Erros/Divergências
    erros: Array<{
        tipo: TipoErro;
        mensagem: string;
    }>;
}

export class DocumentoDetalheShowService {
    async execute(detalheId: number, ciaIds: number[]): Promise<DocumentoDetalheShowResponse> {
        if (ciaIds.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const detalhe = await s4DotzClient.documentoFiscalDetalhe.findUnique({
            where: { id: detalheId },
            include: {
                documentoFiscalErrors: {
                    select: {
                        tipo: true,
                        mensagem: true,
                    },
                },
            },
        });

        // Early return: detalhe não encontrado
        if (!detalhe) {
            throw new AppError("Detalhe do documento fiscal não encontrado", 404);
        }

        const header = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: detalhe.documentoFiscalHeaderId },
            select: {
                ciaId: true,
            },
        });

        if (!header) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciaIds.includes(header.ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        return {
            id: detalhe.id,
            documentoFiscalHeaderId: detalhe.documentoFiscalHeaderId,
            codigoDocumento: detalhe.codigoDocumento,
            itemDocumento: detalhe.itemDocumento,
            codigoProdutoDotz: detalhe.codigoProdutoDotz,
            codigoProdutoFornecedor: detalhe.codigoProdutoFornecedor,
            quantidadeProduto: detalhe.quantidadeProduto,
            descricaoProduto: detalhe.descricaoProduto,
            valorProduto: detalhe.valorProduto ? detalhe.valorProduto.toString() : null,
            valorPedido: detalhe.valorPedido ? detalhe.valorPedido.toString() : null,
            valorFrete: detalhe.valorFrete ? detalhe.valorFrete.toString() : null,
            valorCombo: detalhe.valorCombo ? detalhe.valorCombo.toString() : null,
            codigoPedidoParceiro: detalhe.codigoPedidoParceiro,
            codigoPedidoAnalyzer: detalhe.codigoPedidoAnalyzer,
            codigoDocumentoERP: detalhe.codigoDocumentoERP ?? null,
            divergencias: detalhe.divergencias ?? false,
            grupoPisCofins: detalhe.grupoPisCofins,
            configuracaoContabilDetalheId: detalhe.configuracaoContabilDetalheId,
            // Contas contábeis
            contaContabilCreditoCusto: detalhe.contaContabilCreditoCusto,
            contaContabilDebitoCusto: detalhe.contaContabilDebitoCusto,
            contaContabilCreditoFrete: detalhe.contaContabilCreditoFrete,
            contaContabilDebitoFrete: detalhe.contaContabilDebitoFrete,
            contaContabilCreditoCombo: detalhe.contaContabilCreditoCombo,
            contaContabilDebitoCombo: detalhe.contaContabilDebitoCombo,
            contaContabilCreditoPis: detalhe.contaContabilCreditoPis,
            contaContabilDebitoPis: detalhe.contaContabilDebitoPis,
            contaContabilCreditoCofins: detalhe.contaContabilCreditoCofins,
            contaContabilDebitoCofins: detalhe.contaContabilDebitoCofins,
            contaContabilCreditoValorIs: detalhe.contaContabilCreditoValorIs,
            contaContabilDebitoValorIs: detalhe.contaContabilDebitoValorIs,
            contaContabilCreditoValorCbs: detalhe.contaContabilCreditoValorCbs,
            contaContabilDebitoValorCbs: detalhe.contaContabilDebitoValorCbs,
            contaContabilCreditoValorIbsUf: detalhe.contaContabilCreditoValorIbsUf,
            contaContabilDebitoValorIbsUf: detalhe.contaContabilDebitoValorIbsUf,
            contaContabilCreditoValorIbsMunicipal: detalhe.contaContabilCreditoValorIbsMunicipal,
            contaContabilDebitoValorIbsMunicipal: detalhe.contaContabilDebitoValorIbsMunicipal,
            // Valores calculados
            valorPisOperacaoCredor: detalhe.valorPisOperacaoCredor ? detalhe.valorPisOperacaoCredor.toString() : null,
            valorCofinsOperacaoCredor: detalhe.valorCofinsOperacaoCredor ? detalhe.valorCofinsOperacaoCredor.toString() : null,
            valorIs: detalhe.valorIs ? detalhe.valorIs.toString() : null,
            valorCbs: detalhe.valorCbs ? detalhe.valorCbs.toString() : null,
            valorIbsUf: detalhe.valorIbsUf ? detalhe.valorIbsUf.toString() : null,
            valorIbsMunicipal: detalhe.valorIbsMunicipal ? detalhe.valorIbsMunicipal.toString() : null,
            // Erros/Divergências
            erros: detalhe.documentoFiscalErrors.map((erro: { tipo: string | null; mensagem: string | null }) => ({
                tipo: erro.tipo ?? TipoErro.DIVERGENCIA,
                mensagem: erro.mensagem ?? "",
            })),
        };
    }
}

