import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";
import { DocumentoFiscalDetalhe } from "@prisma/client-s4-dotz";
import {
    extractLegadoMensagemSap,
    parseRetornoIntegracaoSap,
    type RetornoIntegracaoSapPayload,
} from "@/modules/documento-fiscal/utils/integracao/retornoIntegracaoSapJson";
import {
    parsePayloadEnvioSap,
    type DocumentoFiscalPayloadEnvioSap,
} from "@/modules/documento-fiscal/utils/documentoJsonEnvioSap";

interface DocumentoDetalheListParams {
    ciaIds: number[];
    documentoFiscalHeaderId: number;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    id?: number;
    itemDocumento?: number;
    codigoDocumento?: string;
    descricaoProduto?: string;
    codigoPedidoParceiro?: string;
    codigoPedidoAnalyzer?: string;
    divergencias?: boolean;
}

interface DocumentoDetalheListResponse {
    /** Status do documento fiscal (ex.: ERRO_INTEG) */
    status: string;
    /** Payload JSON parseado do retorno SAP (createJournalEntry); null se não houver */
    retornoIntegracaoSap: RetornoIntegracaoSapPayload | null;
    /** Mensagem curta derivada do retorno SAP (compatível com clientes antigos) */
    erroIntegracaoSap: string | null;
    /** Envelope do payload enviado ao SAP (`createJournalEntry`); legado com array na raiz é normalizado */
    payloadEnvioSap: DocumentoFiscalPayloadEnvioSap | null;
    detalhes: Array<{
        id: number;
        documentoFiscalHeaderId: number;
        codigoDocumento: string;
        codigoFornecedorSAP: string | null;
        codigoDocumentoERP: string | null;
        itemDocumento: number | null;
        quantidadeProduto: number | null;
        descricaoProduto: string | null;
        valorProduto: string | null;
        valorPedido: string | null;
        valorFrete: string | null;
        codigoPedidoParceiro: string | null;
        codigoPedidoAnalyzer: string | null;
        divergencias: boolean;
    }>;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class DocumentoDetalheListService {
    async execute(params: DocumentoDetalheListParams): Promise<DocumentoDetalheListResponse> {
        const {
            ciaIds: ciasPermitidas,
            documentoFiscalHeaderId,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            id,
            itemDocumento,
            codigoDocumento,
            descricaoProduto,
            codigoPedidoParceiro,
            codigoPedidoAnalyzer,
            divergencias,
        } = params;

        if (ciasPermitidas.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const header = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                id: true,
                ciaId: true,
                status: true,
                retornoIntegracaoSap: true,
                documentoJson: true,
            },
        });

        if (!header) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciasPermitidas.includes(header.ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        const codigoDocumentoFiltro = codigoDocumento?.trim();
        const descricaoProdutoFiltro = descricaoProduto?.trim();
        const pedidoParceiroFiltro = codigoPedidoParceiro?.trim();
        const docEntryPedidoFiltro = codigoPedidoAnalyzer?.trim();

        const baseWhere = {
            documentoFiscalHeaderId,
            ...(id ? { id } : {}),
            ...(itemDocumento ? { itemDocumento } : {}),
            ...(codigoDocumentoFiltro ? { codigoDocumento: { contains: codigoDocumentoFiltro } } : {}),
            ...(descricaoProdutoFiltro ? { descricaoProduto: { contains: descricaoProdutoFiltro } } : {}),
            ...(pedidoParceiroFiltro ? { codigoPedidoParceiro: { contains: pedidoParceiroFiltro } } : {}),
            ...(docEntryPedidoFiltro ? { codigoPedidoAnalyzer: { contains: docEntryPedidoFiltro } } : {}),
            ...(typeof divergencias === "boolean" ? { divergencias } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, {}, { itemDocumento: "asc" });

        const skip = (page - 1) * limit;

        const [totalItems, detalhes] = await Promise.all([
            s4DotzClient.documentoFiscalDetalhe.count({ where }),
            s4DotzClient.documentoFiscalDetalhe.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formattedDetalhes = detalhes.map((detalhe: DocumentoFiscalDetalhe) => ({
            id: detalhe.id,
            documentoFiscalHeaderId: detalhe.documentoFiscalHeaderId,
            codigoDocumento: detalhe.codigoDocumento,
            codigoFornecedorSAP: detalhe.codigoFornecedorSAP ?? null,
            codigoDocumentoERP: detalhe.codigoDocumentoERP ?? null,
            itemDocumento: detalhe.itemDocumento,
            quantidadeProduto: detalhe.quantidadeProduto,
            descricaoProduto: detalhe.descricaoProduto,
            valorProduto: detalhe.valorProduto ? detalhe.valorProduto.toString() : null,
            valorPedido: detalhe.valorPedido ? detalhe.valorPedido.toString() : null,
            valorFrete: detalhe.valorFrete ? detalhe.valorFrete.toString() : null,
            codigoPedidoParceiro: detalhe.codigoPedidoParceiro,
            codigoPedidoAnalyzer: detalhe.codigoPedidoAnalyzer,
            divergencias: detalhe.divergencias ?? false,
        }));

        const rawRetorno = header.retornoIntegracaoSap ?? null;

        return {
            status: header.status,
            retornoIntegracaoSap: parseRetornoIntegracaoSap(rawRetorno),
            erroIntegracaoSap: extractLegadoMensagemSap(rawRetorno),
            payloadEnvioSap: parsePayloadEnvioSap(header.documentoJson, header.id),
            detalhes: formattedDetalhes,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}

