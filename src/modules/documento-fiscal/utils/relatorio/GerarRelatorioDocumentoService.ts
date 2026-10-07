import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { DocumentoPDFGenerator } from "@/modules/documento-fiscal/utils/relatorio/DocumentoPDFGenerator";
import { DocumentoXLSXGenerator } from "@/modules/documento-fiscal/utils/relatorio/DocumentoXLSXGenerator";
import AppError from "@/util/AppError";
import { formatDateOnly } from "@/util/date";
import log from "@/util/logger";
import { UploadDiskStorageService } from "@/util/services/upload.service";
import { Decimal } from "@prisma/client-s4-dotz/runtime/library";
import crypto from "node:crypto";

interface GerarRelatorioDocumentoParams {
    documentoFiscalHeaderId: number;
    codigoFornecedorSAP?: string;
}

interface GerarRelatorioDocumentoResponse {
    pdfPath: string;
    pdfFilename: string;
    xlsxPath: string;
    xlsxFilename: string;
}

/**
 * Service reutilizável para geração de relatório PDF de documento fiscal.
 * Não faz verificação de permissões - deve ser usado por services que já validaram o acesso.
 * Pode ser chamado por: DocumentoRelatorioService, ProcessamentoRomaneio, AprovacaoRomaneio, ProcessamentoPOS, etc.
 */
export class GerarRelatorioDocumentoService {
    private readonly pdfGenerator = new DocumentoPDFGenerator();
    private readonly xlsxGenerator = new DocumentoXLSXGenerator();
    private readonly uploadDiskStorageService = new UploadDiskStorageService();
     

    async execute(params: GerarRelatorioDocumentoParams): Promise<GerarRelatorioDocumentoResponse> {
        const { documentoFiscalHeaderId, codigoFornecedorSAP } = params;

        // Buscar documento fiscal header com CIA
        const documento = await this.fetchDocumento(documentoFiscalHeaderId);

        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        const codigoFornecedor = codigoFornecedorSAP || documento.codigoFornecedorSAP;

        // Buscar fornecedor do header (ou fornecedor específico)
        const fornecedorHeader = await this.fetchFornecedorHeader(codigoFornecedor);

        // Buscar detalhes do documento fiscal
        const detalhes = await this.fetchDetalhes(documentoFiscalHeaderId, codigoFornecedorSAP);

        // Buscar dados complementares para cada detalhe
        const detalhesEnriquecidos = await this.enrichDetalhes(detalhes, documento.tipoDocumentoERP);

        // Calcular totais
        const { totalValorProduto, totalFrete, totalValorPedido } = this.calculateTotals(detalhes);

        const quantidadePedidos = codigoFornecedorSAP
            ? detalhes.length
            : documento.quantidadeTotalPedidos || detalhes.length;

        // Romaneio: valor líquido (após descontos) = valorTotalProdutos
        // POS: valor bruto = valorTotalPedido (mantém lógica original)
        const valorTotalDocumento = this.resolveValorTotalDocumento(
            documento,
            codigoFornecedorSAP,
            totalValorProduto,
            totalValorPedido
        );

        // Preparar dados para o PDF
        const pdfData = {
            cia: {
                nome: documento.cia.nome,
                cpfCnpj: documento.cia.cpfCnpj,
                ie: documento.cia.ie,
                endereco: documento.cia.endereco,
                bairro: documento.cia.bairro,
                municipio: documento.cia.municipio,
                uf: documento.cia.uf,
                cep: documento.cia.cep,
                telefone: documento.cia.telefone,
            },
            fornecedor: {
                cardName: fornecedorHeader?.CardName || null,
                cnpj: fornecedorHeader?.cnpj || null,
                ie: fornecedorHeader?.ie || "isento",
                endereco: fornecedorHeader?.endereco || null,
                municipio: fornecedorHeader?.municipio || null,
                cep: fornecedorHeader?.cep || null,
            },
            resumo: {
                quantidadePedidos,
                valorTotalDocumento: valorTotalDocumento.toFixed(2),
            },
            detalhes: detalhesEnriquecidos,
            totalValorProduto: totalValorProduto.toFixed(2),
            totalFrete: totalFrete.toFixed(2),
        };

        // Gerar PDF
        const pdfBytes = await this.pdfGenerator.generate(pdfData);
        // Salvar PDF no storage
        const pdfPath = await this.saveReport(pdfBytes, documento.id, codigoFornecedor, 'pdf');

        // Gerar XLSX
        const xlsxBytes = this.xlsxGenerator.execute({
            detalhes: detalhesEnriquecidos,
            totalValorProduto: totalValorProduto.toFixed(2),
            totalFrete: totalFrete.toFixed(2),
        });
        const xlsxPath = await this.saveReport(xlsxBytes, documento.id, codigoFornecedor, 'xlsx');

        await this.persistRelatorioPaths(documento.id, pdfPath, xlsxPath);

        return {
            pdfPath: pdfPath.realtivePath,
            pdfFilename: pdfPath.filename,
            xlsxPath: xlsxPath.realtivePath,
            xlsxFilename: xlsxPath.filename,
        };
    }

    private async fetchDocumento(id: number) {
        return s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id },
            select: {
                id: true,
                ciaId: true,
                codigoDocumento: true,
                codigoFornecedorSAP: true,
                tipoDocumentoERP: true,
                quantidadeTotalPedidos: true,
                valorTotalPedido: true,
                valorTotalProdutos: true,
                cia: {
                    select: {
                        id: true,
                        nome: true,
                        cpfCnpj: true,
                        ie: true,
                        endereco: true,
                        bairro: true,
                        municipio: true,
                        uf: true,
                        cep: true,
                        telefone: true,
                    },
                },
            },
        });
    }

    private async fetchFornecedorHeader(codigoFornecedorSAP: string | null) {
        if (!codigoFornecedorSAP) {
            return null;
        }

        return dotzStageClient().oCRD.findUnique({
            where: {
                CardCode: codigoFornecedorSAP,
            },
            select: {
                CardName: true,
                cnpj: true,
                ie: true,
                endereco: true,
                municipio: true,
                cep: true,
            },
        });
    }

    private async fetchDetalhes(documentoFiscalHeaderId: number, codigoFornecedorSAP?: string) {
        return s4DotzClient.documentoFiscalDetalhe.findMany({
            where: {
                documentoFiscalHeaderId,
                ...(codigoFornecedorSAP ? { codigoFornecedorSAP } : {}),
            },
            orderBy: {
                itemDocumento: "asc",
            },
            select: {
                id: true,
                codigoFornecedorSAP: true,
                codigoPedidoParceiro: true,
                codigoProdutoFornecedor: true,
                codigoProdutoRomaneio: true,
                codigoProdutoDotz: true,
                descricaoProduto: true,
                valorProduto: true,
                valorPedido: true,
                valorFrete: true,
                criadoEm: true,
            },
        });
    }

    private async fetchRefdotzBatch(codigosPedido: string[]): Promise<any[]> {
        if (codigosPedido.length === 0) {
            return [];
        }

        try {
            const pedidosNum = codigosPedido
                .map(c => Number.parseInt(c, 10))
                .filter(n => !Number.isNaN(n));

            if (pedidosNum.length === 0) {
                return [];
            }

            return await dotzStageClient().rEFDOTZ.findMany({
                where: {
                    U_PEDCOMPRA: { in: pedidosNum },
                },
                select: {
                    U_PEDCOMPRA: true,
                    U_CLIENTE: true,
                },
            });
        } catch (error) {
            log.error('Erro ao buscar dados REFDOTZ em lote (Não quebra a execução): %o', error);
            return [];
        }
    }

    private async fetchOcrdBatch(cardCodes: string[]): Promise<any[]> {
        if (cardCodes.length === 0) {
            return [];
        }

        try {
            return await dotzStageClient().oCRD.findMany({
                where: {
                    CardCode: { in: cardCodes },
                },
                select: {
                    CardCode: true,
                    CardName: true,
                    cnpj: true,
                },
            });
        } catch (error) {
            log.error('Erro ao buscar dados OCRD em lote (Não quebra a execução): %o', error);
            return [];
        }
    }

    private async enrichDetalhes(detalhes: any[], tipoDocumentoERP: string) {
        // 1. Extrair códigos únicos de todos os detalhes
        const codigosPedidoParceiro = [...new Set(
            detalhes
                .map(d => d.codigoPedidoParceiro)
                .filter(Boolean)
        )];

        const codigosFornecedorSAP = [...new Set(
            detalhes
                .map(d => d.codigoFornecedorSAP)
                .filter(Boolean)
        )];

        // 2. Buscar todos os dados em lote (2 queries ao invés de N*2 queries)
        const [refdotzList, ocrdList] = await Promise.all([
            this.fetchRefdotzBatch(codigosPedidoParceiro),
            this.fetchOcrdBatch(codigosFornecedorSAP),
        ]);

        // 3. Criar Maps para lookup O(1)
        const refdotzMap = new Map(
            refdotzList.map(r => [r.U_PEDCOMPRA, r])
        );

        const ocrdMap = new Map(
            ocrdList.map(o => [o.CardCode, o])
        );

        // 4. Enriquecer detalhes usando lookups (sem queries adicionais)
        return detalhes.map(detalhe => {
            // Lookup REFDOTZ
            let nomeCliente = "N/A";
            let pedidoCompra = "N/A";

            if (detalhe.codigoPedidoParceiro) {
                const pedidoParceiroNum = Number.parseInt(detalhe.codigoPedidoParceiro, 10);
                if (!Number.isNaN(pedidoParceiroNum)) {
                    const refdotz = refdotzMap.get(pedidoParceiroNum);
                    if (refdotz) {
                        nomeCliente = refdotz.U_CLIENTE || "N/A";
                        pedidoCompra = refdotz.U_PEDCOMPRA?.toString() || "N/A";
                    }
                }
            }

            // Lookup OCRD
            let parceiroCardName = "N/A";
            let cnpjFornecedor = "N/A";

            if (detalhe.codigoFornecedorSAP) {
                const fornecedor = ocrdMap.get(detalhe.codigoFornecedorSAP);
                if (fornecedor) {
                    parceiroCardName = fornecedor.CardName || "N/A";
                    cnpjFornecedor = fornecedor.cnpj || "N/A";
                }
            }

            // Determinar código do produto baseado no tipo de processo
            // TP_ROM: usa codigoProdutoRomaneio (vem da coluna PRODUTO da planilha)
            // TP_POS: usa codigoProdutoDotz (vem da tabela OITM.ItemCode)
            let codigoProduto = "N/A";
            if (tipoDocumentoERP === "TP_ROM") {
                codigoProduto = detalhe.codigoProdutoRomaneio || "N/A";
            } else if (tipoDocumentoERP === "TP_POS") {
                codigoProduto = detalhe.codigoProdutoDotz || "N/A";
            }

            return {
                data: formatDateOnly(detalhe.criadoEm),
                cnpj: cnpjFornecedor,
                pedido: pedidoCompra,
                nome: nomeCliente,
                codigo: detalhe.codigoFornecedorSAP || "N/A",
                parceiro: parceiroCardName,
                produto: codigoProduto,
                descricao: detalhe.descricaoProduto || "N/A",
                valorProduto: detalhe.valorProduto ? detalhe.valorProduto.toFixed(2) : "0.00",
                frete: detalhe.valorFrete ? detalhe.valorFrete.toFixed(2) : "0.00",
            };
        });
    }

    private resolveValorTotalDocumento(
        documento: { tipoDocumentoERP: string; valorTotalProdutos?: Decimal | null; valorTotalPedido?: Decimal | null },
        codigoFornecedorSAP: string | undefined,
        totalValorProduto: Decimal,
        totalValorPedido: Decimal
    ): Decimal {
        if (codigoFornecedorSAP) {
            return documento.tipoDocumentoERP === "TP_ROM" ? totalValorProduto : totalValorPedido;
        }
        if (documento.tipoDocumentoERP === "TP_ROM") {
            return documento.valorTotalProdutos ?? totalValorProduto;
        }
        return documento.valorTotalPedido ?? totalValorPedido;
    }

    private calculateTotals(detalhes: any[]): {
        totalValorProduto: Decimal;
        totalFrete: Decimal;
        totalValorPedido: Decimal;
    } {
        let totalValorProduto = new Decimal(0);
        let totalFrete = new Decimal(0);
        let totalValorPedido = new Decimal(0);

        for (const detalhe of detalhes) {
            if (detalhe.valorProduto) {
                totalValorProduto = totalValorProduto.plus(detalhe.valorProduto);
            }
            if (detalhe.valorFrete) {
                totalFrete = totalFrete.plus(detalhe.valorFrete);
            }
            if (detalhe.valorPedido) {
                totalValorPedido = totalValorPedido.plus(detalhe.valorPedido);
            }
        }

        return { totalValorProduto, totalFrete, totalValorPedido };
    }

    private async saveReport(
        bytes: Buffer,
        documentoId: number,
        codigoFornecedorSAP: string,
        extensao: string
    ): Promise<{filename:string, realtivePath:string}> {
        const hash = crypto.randomBytes(8).toString("hex");
        const filename = `relatorio-trocas-pos-${codigoFornecedorSAP}-${documentoId}-${hash}.${extensao}`;
        const realtivePath = await this.uploadDiskStorageService.uploadReportPos(bytes, filename);
        return {filename, realtivePath};
    }

    private async persistRelatorioPaths(
        documentoId: number,
        pdf: { filename: string; realtivePath: string },
        xlsx: { filename: string; realtivePath: string }
    ): Promise<void> {
        await s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoId },
            data: {
                posRelatorioPdfUrl: pdf.realtivePath,
                posRelatorioPdfFileName: pdf.filename,
                posRelatorioXlsxUrl: xlsx.realtivePath,
                posRelatorioXlsxFileName: xlsx.filename,
            },
        });
    }
}
