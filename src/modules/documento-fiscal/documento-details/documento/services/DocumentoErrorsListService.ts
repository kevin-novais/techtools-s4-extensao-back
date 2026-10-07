import s4DotzClient from "@/database/clients/s4DotzClient";
import getDotzStageClient from "@/database/clients/dotzStageClient";
import AppError from "@/util/AppError";
import { agGridFilterModelToPrismaWhere, agGridSortModelToPrismaOrderBy, mergePrismaWhere } from "@/util/filter";
import { TipoErro } from "@/@types/DocumentoFiscalError/TipoErroTypes";
import { Prisma } from "@prisma/client-s4-dotz";
import { Decimal } from "@prisma/client-dotz-stage/runtime/library";
import { chunkArray } from "@/util/chunkArray";

type DocumentoErrorWithDetalhe = Prisma.DocumentoFiscalErrorsGetPayload<{
    include: {
        documentoFiscalDetalhe: {
            select: {
                id: true;
                documentoFiscalHeaderId: true;
                codigoDocumento: true;
                itemDocumento: true;
                codigoProdutoDotz: true;
                codigoProdutoFornecedor: true;
                quantidadeProduto: true;
                descricaoProduto: true;
                valorProduto: true;
                valorPedido: true;
                valorFrete: true;
                valorCombo: true;
                codigoPedidoParceiro: true;
                codigoPedidoAnalyzer: true;
            };
        };
    };
}>;

interface POR1AnalyzerData {
    DocEntry: number;
    Quantity: Decimal | null;
    Price: Decimal | null;
    LineTotal: Decimal | null;
}

interface POR2AnalyzerData {
    DocEntry: number;
    LineTotal: Decimal | null;
    ExpnsCode: number | null;
}

interface DocumentoErrorsListParams {
    ciaIds: number[];
    documentoFiscalHeaderId: number;
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    tipo?: string;
    detalheId?: number;
    itemDocumento?: number;
    codigoErro?: string;
}

interface DocumentoErrorsListResponse {
    divergencias: Array<{
        id: number;
        tipo: TipoErro;
        code: string | null;
        mensagem: string;
        detalhe: {
            id: number;
            documentoFiscalHeaderId: number;
            codigoDocumento: string;
            itemDocumento: number | null;
            // Dados do Produto
            codigoProdutoDotz: string | null;
            codigoProdutoFornecedor: string | null;
            // Dados do Documento
            quantidadeProdutoDocumento: number | null;
            descricaoProduto: string | null;
            valorProdutoDocumento: string | null;
            valorPedidoDocumento: string | null;
            valorFrete: string | null;
            valorCombo: string | null;
            codigoPedidoParceiro: string | null;
            codigoPedidoAnalyzer: string | null;
            // Dados do Analyzer
            quantidadeProdutoAnalyzer: string | null;
            valorProdutoAnalyzer: string | null;
            valorPedidoAnalyzer: string | null;
            valorFreteAnalyzer: string | null;
        };
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

export class DocumentoErrorsListService {
    async execute(params: DocumentoErrorsListParams): Promise<DocumentoErrorsListResponse> {
        const {
            ciaIds: ciasPermitidas,
            documentoFiscalHeaderId,
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            tipo,
            detalheId,
            itemDocumento,
            codigoErro,
        } = params;

        if (ciasPermitidas.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const header = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                id: true,
                ciaId: true,
            },
        });

        if (!header) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciasPermitidas.includes(header.ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        const baseWhere = {
            documentoFiscalDetalhe: {
                documentoFiscalHeaderId,
                ...(detalheId ? { id: detalheId } : {}),
                ...(itemDocumento ? { itemDocumento } : {}),
            },
            ...(tipo ? { tipo } : {}),
            ...(codigoErro ? { code: { contains: codigoErro } } : {}),
        };

        const relationMap = {
            "documentoFiscalDetalhe.id": "documentoFiscalDetalhe",
            "documentoFiscalDetalhe.itemDocumento": "documentoFiscalDetalhe",
            "documentoFiscalDetalhe.codigoDocumento": "documentoFiscalDetalhe",
            "documentoFiscalDetalhe.codigoPedidoParceiro": "documentoFiscalDetalhe",
            "documentoFiscalDetalhe.codigoPedidoAnalyzer": "documentoFiscalDetalhe",
        };
        const fieldMap = {
            "detalhe.id": "documentoFiscalDetalhe.id",
            "detalhe.itemDocumento": "documentoFiscalDetalhe.itemDocumento",
            "detalhe.codigoDocumento": "documentoFiscalDetalhe.codigoDocumento",
            "detalhe.codigoPedidoParceiro": "documentoFiscalDetalhe.codigoPedidoParceiro",
            "detalhe.codigoPedidoAnalyzer": "documentoFiscalDetalhe.codigoPedidoAnalyzer",
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel, relationMap);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const defaultOrderBy = [
            {
                documentoFiscalDetalhe: {
                    itemDocumento: "asc",
                },
            },
            {
                id: "asc",
            },
        ];
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, relationMap, fieldMap, defaultOrderBy);

        const skip = (page - 1) * limit;

        const [totalItems, errors] = await Promise.all([
            s4DotzClient.documentoFiscalErrors.count({ where }),
            s4DotzClient.documentoFiscalErrors.findMany({
                where,
                include: {
                    documentoFiscalDetalhe: {
                        select: {
                            id: true,
                            documentoFiscalHeaderId: true,
                            codigoDocumento: true,
                            itemDocumento: true,
                            codigoProdutoDotz: true,
                            codigoProdutoFornecedor: true,
                            quantidadeProduto: true,
                            descricaoProduto: true,
                            valorProduto: true,
                            valorPedido: true,
                            valorFrete: true,
                            valorCombo: true,
                            codigoPedidoParceiro: true,
                            codigoPedidoAnalyzer: true,
                        },
                    },
                },
                orderBy,
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        // Busca dados do Analyzer para comparação (POR1 e POR2)
        const [dadosPOR1Map, dadosPOR2Map] = await Promise.all([
            this.buscarDadosAnalyzer(errors),
            this.buscarDadosPOR2(errors),
        ]);

        const formattedDivergencias = errors.map((error: DocumentoErrorWithDetalhe) => {
            const docEntry = error.documentoFiscalDetalhe.codigoPedidoAnalyzer;
            const dadosPOR1 = docEntry ? dadosPOR1Map.get(Number(docEntry)) : null;
            const dadosPOR2 = docEntry ? dadosPOR2Map.get(Number(docEntry)) : null;

            return {
                id: error.id,
                tipo: error.tipo ?? TipoErro.DIVERGENCIA,
                code: error.code ?? null,
                mensagem: error.mensagem ?? "",
                detalhe: {
                    id: error.documentoFiscalDetalhe.id,
                    documentoFiscalHeaderId: error.documentoFiscalDetalhe.documentoFiscalHeaderId,
                    codigoDocumento: error.documentoFiscalDetalhe.codigoDocumento,
                    itemDocumento: error.documentoFiscalDetalhe.itemDocumento,
                    // Dados do Produto
                    codigoProdutoDotz: error.documentoFiscalDetalhe.codigoProdutoDotz,
                    codigoProdutoFornecedor: error.documentoFiscalDetalhe.codigoProdutoFornecedor,
                    // Dados do Documento
                    quantidadeProdutoDocumento: error.documentoFiscalDetalhe.quantidadeProduto,
                    descricaoProduto: error.documentoFiscalDetalhe.descricaoProduto,
                    valorProdutoDocumento: error.documentoFiscalDetalhe.valorProduto
                        ? error.documentoFiscalDetalhe.valorProduto.toString()
                        : null,
                    valorPedidoDocumento: error.documentoFiscalDetalhe.valorPedido
                        ? error.documentoFiscalDetalhe.valorPedido.toString()
                        : null,
                    valorFrete: error.documentoFiscalDetalhe.valorFrete
                        ? error.documentoFiscalDetalhe.valorFrete.toString()
                        : null,
                    valorCombo: error.documentoFiscalDetalhe.valorCombo
                        ? error.documentoFiscalDetalhe.valorCombo.toString()
                        : null,
                    // Dados do Analyzer
                    quantidadeProdutoAnalyzer: dadosPOR1?.Quantity ? dadosPOR1.Quantity.toString() : null,
                    valorProdutoAnalyzer: dadosPOR1?.Price ? dadosPOR1.Price.toString() : null,
                    valorPedidoAnalyzer: dadosPOR1?.LineTotal ? dadosPOR1.LineTotal.toString() : null,
                    valorFreteAnalyzer: dadosPOR2?.LineTotal ? dadosPOR2.LineTotal.toString() : null,
                    codigoPedidoParceiro: error.documentoFiscalDetalhe.codigoPedidoParceiro,
                    codigoPedidoAnalyzer: error.documentoFiscalDetalhe.codigoPedidoAnalyzer,
                },
            };
        });

        return {
            divergencias: formattedDivergencias,
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

    /**
     * Busca dados do Analyzer (POR1) para comparação com dados do Documento
     * 
     * PERFORMANCE: Uma única query com WHERE IN para buscar todos os pedidos
     * Retorna Map para lookup O(1) durante formatação
     */
    private async buscarDadosAnalyzer(errors: DocumentoErrorWithDetalhe[]): Promise<Map<number, POR1AnalyzerData>> {
        // Extrai codigoPedidoAnalyzer únicos, filtrando nulls
        const docEntries = errors
            .map((error) => error.documentoFiscalDetalhe.codigoPedidoAnalyzer)
            .filter((docEntry): docEntry is string => docEntry !== null)
            .map(Number)
            .filter((docEntry, index, self) => self.indexOf(docEntry) === index); // Remove duplicatas

        // Early return: Nenhum docEntry encontrado
        if (docEntries.length === 0) {
            return new Map();
        }

        const dotzStageClient = getDotzStageClient();

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const chunks = chunkArray(docEntries);
        const todosPedidos = [];

        for (const chunk of chunks) {
            const resultado = await dotzStageClient.pOR1.findMany({
                where: {
                    DocEntry: { in: chunk },
                },
                select: {
                    DocEntry: true,
                    Quantity: true,
                    Price: true,
                    LineTotal: true,
                },
            });
            todosPedidos.push(...resultado);
        }

        // Converte array para Map para lookup O(1)
        const dadosAnalyzerMap = new Map<number, POR1AnalyzerData>();
        for (const pedido of todosPedidos) {
            dadosAnalyzerMap.set(pedido.DocEntry, pedido);
        }

        return dadosAnalyzerMap;
    }

    /**
     * Busca dados do frete do Analyzer (POR2) para comparação com dados do Documento
     * 
     * IMPORTANTE: POR2.DocEntry referencia OPOR.DocEntry (pedido), não POR1.DocEntry (item)
     * Como estamos buscando por POR1.DocEntry, precisamos obter o OPOR.DocEntry correspondente
     * 
     * PERFORMANCE: Uma única query com WHERE IN para buscar frete de todos os pedidos
     * Retorna Map para lookup O(1) durante formatação
     */
    private async buscarDadosPOR2(errors: DocumentoErrorWithDetalhe[]): Promise<Map<number, POR2AnalyzerData>> {
        // Extrai codigoPedidoAnalyzer únicos (que são POR1.DocEntry)
        const por1DocEntries = errors
            .map((error) => error.documentoFiscalDetalhe.codigoPedidoAnalyzer)
            .filter((docEntry): docEntry is string => docEntry !== null)
            .map(Number)
            .filter((docEntry, index, self) => self.indexOf(docEntry) === index);

        // Early return: Nenhum docEntry encontrado
        if (por1DocEntries.length === 0) {
            return new Map();
        }

        const dotzStageClient = getDotzStageClient();

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const chunks = chunkArray(por1DocEntries);
        const todosPor1Items = [];

        for (const chunk of chunks) {
            const resultado = await dotzStageClient.pOR1.findMany({
                where: {
                    DocEntry: { in: chunk },
                },
                select: {
                    DocEntry: true, // POR1.DocEntry (item)
                },
            });
            todosPor1Items.push(...resultado);
        }

        // Como POR1.DocEntry é igual a OPOR.DocEntry (mesmo campo), usamos diretamente
        const oporDocEntries = todosPor1Items.map((item: { DocEntry: number }) => item.DocEntry);

        if (oporDocEntries.length === 0) {
            return new Map();
        }

        // SQL Server tem limite de 2100 parâmetros. Dividir em chunks para evitar erro.
        const chunksOpor = chunkArray(oporDocEntries);
        const todosFretes = [];

        for (const chunk of chunksOpor) {
            const resultado = await dotzStageClient.pOR2.findMany({
                where: {
                    DocEntry: { in: chunk },
                },
                select: {
                    DocEntry: true,
                    LineTotal: true,
                    ExpnsCode: true,
                },
            });
            todosFretes.push(...resultado);
        }

        // Converte array para Map para lookup O(1)
        // Chave é o DocEntry (que é o mesmo para OPOR e POR1)
        const freteAnalyzerMap = new Map<number, POR2AnalyzerData>();
        for (const frete of todosFretes) {
            freteAnalyzerMap.set(frete.DocEntry, frete);
        }

        return freteAnalyzerMap;
    }
}

