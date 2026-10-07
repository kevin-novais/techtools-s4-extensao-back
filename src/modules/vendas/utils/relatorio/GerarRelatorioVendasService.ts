import { Config } from "@/config/config";
import uploadConfig from "@/config/upload";
import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { VendasFaturaPDFGenerator } from "@/modules/vendas/utils/relatorio/VendasFaturaPDFGenerator";
import { VendasFaturaXLSXGenerator } from "@/modules/vendas/utils/relatorio/VendasFaturaXLSXGenerator";
import { GCSStorage } from "@/providers/gcs-storage";
import AppError from "@/util/AppError";
import { formatDateOnly, formatMonthYear } from "@/util/date";
import log from "@/util/logger";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

interface GerarRelatorioVendasParams {
    vendasHeaderId: number;
}

interface GerarRelatorioVendasResponse {
    pdfUrl: string;
    pdfFilename: string;
    xlsxUrl: string;
    xlsxFilename: string;
}

const RELATORIOS_GCS_SUBFOLDER = "relatorios";

export class GerarRelatorioVendasService {
    private readonly pdfGenerator = new VendasFaturaPDFGenerator();
    private readonly xlsxGenerator = new VendasFaturaXLSXGenerator();
    private readonly gcsStorage: GCSStorage;

    constructor(gcsStorage: GCSStorage = new GCSStorage()) {
        this.gcsStorage = gcsStorage;
    }

    async execute(params: GerarRelatorioVendasParams): Promise<GerarRelatorioVendasResponse> {
        const { vendasHeaderId } = params;

        const vendaHeader = await this.fetchVendaHeader(vendasHeaderId);

        if (!vendaHeader) {
            throw new AppError("Venda não encontrada", 404);
        }

        // ciaId no VendasHeader é o ciaIdSAP — buscar a CIA pelo código SAP
        const cia = await this.fetchCiaByCiaIdSAP(vendaHeader.ciaIdSAP);

        // Buscar cliente no OCRD (tabela de parceiros SAP)
        const cliente = await this.fetchCliente(vendaHeader.codigoClienteSAP);

        // Buscar detalhes da venda
        const detalhes = await this.fetchDetalhes(vendasHeaderId);

        const valorTotal = vendaHeader.valorTotalVendas?.toFixed(2);

        // Concatenar ciaId + codigoDocumentoERP para exibição no relatório
        const codigoDocumentoERP = vendaHeader.codigoDocumentoERP
            ? `${vendaHeader.ciaIdSAP}-${vendaHeader.codigoDocumentoERP}`
            : null;

        const isPagamentoBoleto = cliente?.FORMA_PAGAMENTO?.trim() === "E" ? true : false;

        const dataFaturamento = vendaHeader.dataEmissao ? formatMonthYear(vendaHeader.dataEmissao) : '';
        // Gerar PDF
        const pdfBytes = await this.pdfGenerator.generate({
            numeroDocumento: codigoDocumentoERP!,
            numeroFaturaParceiro: vendaHeader.numeroFaturaParceiro || '',
            dataEmissao: vendaHeader.dataEmissao ? formatDateOnly(vendaHeader.dataEmissao) : '',
            dataVencimento: vendaHeader.dataVencimento ? formatDateOnly(vendaHeader.dataVencimento) : '',
            dataFaturamento: dataFaturamento,
            isPagamentoBoleto: isPagamentoBoleto,
            informacoesAdicionais: vendaHeader.infoReferenciaAnalyzer || '',
            valorTotal: valorTotal || '',
            detalhes: detalhes,
            cia: {
                nome: cia?.nome || '',
                cpfCnpj: cia?.cpfCnpj || '',
                ie: cia?.ie || '',
                endereco: cia?.endereco || '',
                bairro: cia?.bairro || '',
                municipio: cia?.municipio || '',
                uf: cia?.uf || '',
                cep: cia?.cep || '',
                telefone: cia?.telefone || '',
                email: Config.DOTZ_EMAIL_CONTAS_RECEBER || '',
            },
            cliente: {
                cardName: cliente?.CardName || '',
                cnpj: cliente?.cnpj || '',
                ie: cliente?.ie || "Isento",
                endereco: cliente?.endereco || '',
                municipio: cliente?.municipio || '',
                cep: cliente?.cep ? cliente.cep.trim() : '',
                email: cliente?.email || '',
                telefone: cliente?.telefone || '',
            },
        });

        // Gerar XLSX
        const xlsxBytes = this.xlsxGenerator.execute({
            detalhes: detalhes,
            totalValorVenda: valorTotal,
        });

        // Salvar PDF
        const pdf = await this.saveFile(
            pdfBytes,
            vendasHeaderId,
            vendaHeader.numeroDocumentoAnalyzer || '',
            "pdf",
        );

        // Salvar XLSX
        const xlsx = await this.saveFile(
            xlsxBytes,
            vendasHeaderId,
            vendaHeader.numeroDocumentoAnalyzer || '',
            "xlsx",
        );

        // Persistir URLs no banco
        await this.persistRelatorioPaths(vendasHeaderId, pdf.url, xlsx.url);

        return { pdfUrl: pdf.url, pdfFilename: pdf.filename, xlsxUrl: xlsx.url, xlsxFilename: xlsx.filename };
    }

    private async fetchVendaHeader(id: number) {
        return s4DotzClient.vendasHeader.findUnique({
            where: { id },
            select: {
                id: true,
                ciaIdSAP: true,
                codigoClienteSAP: true,
                codigoClienteAnalyzer: true,
                numeroDocumentoAnalyzer: true,
                numeroFaturaParceiro: true,
                infoReferenciaAnalyzer: true,
                valorTotalVendas: true,
                codigoDocumentoERP: true,
                dataEmissao: true,
                dataVencimento: true,
                dataFechamentoAte: true,
            },
        });
    }

    private async fetchCiaByCiaIdSAP(ciaId: string) {
        try {
            return await s4DotzClient.cia.findFirst({
                where: {
                    ciaIdSAP: ciaId,
                    deletadoEm: null,
                },
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
            });
        } catch (error) {
            log.error("Erro ao buscar CIA por ciaIdSAP (não quebra a execução): %o", error);
            return null;
        }
    }

    private async fetchCliente(codigoClienteSAP: string | null) {
        if (!codigoClienteSAP) {
            return null;
        }

        try {
            return await dotzStageClient().oCRD.findUnique({
                where: { CardCode: codigoClienteSAP },
                select: {
                    CardName: true,
                    cnpj: true,
                    ie: true,
                    endereco: true,
                    municipio: true,
                    cep: true,
                    email: true,
                    telefone: true,
                    FORMA_PAGAMENTO: true
                },
            });
        } catch (error) {
            log.error("Erro ao buscar cliente OCRD (não quebra a execução): %o", error);
            return null;
        }
    }

    private async fetchDetalhes(vendasHeaderId: number) {
        return s4DotzClient.vendasDetalhe.findMany({
            where: { vendasHeaderId },
            orderBy: { itemDocumento: "asc" },
            select: {
                id: true,
                itemDocumento: true,
                quantidadePontos: true,
                valorVenda: true,
                precoUnitario: true,
                descricaoProduto: true,
                codigoProdutoDotz: true
            },
        });
    }

    private async saveFile(
        bytes: Uint8Array | Buffer,
        vendasHeaderId: number,
        numeroDocumento: string,
        extension: string,
    ): Promise<{ filename: string; url: string }> {
        const tmpFolder = uploadConfig.TMP_FOLDER;

        if (!fs.existsSync(tmpFolder)) {
            fs.mkdirSync(tmpFolder, { recursive: true });
        }

        const timestamp = Date.now();
        const hash = crypto.randomBytes(8).toString("hex");
        const filename = `fatura-${vendasHeaderId}-${numeroDocumento}-${timestamp}-${hash}.${extension}`;
        const tmpPath = path.join(tmpFolder, filename);

        fs.writeFileSync(tmpPath, bytes);

        const blobName = await this.gcsStorage.saveFile(filename, RELATORIOS_GCS_SUBFOLDER);
        const url = this.gcsStorage.getPublicUrl(blobName);

        return { filename, url };
    }

    private async persistRelatorioPaths(
        vendasHeaderId: number,
        pdfUrl: string,
        xlsxUrl: string,
    ): Promise<void> {
        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                relatorioPdf: pdfUrl,
                relatorioXlsx: xlsxUrl,
            },
        });
    }
}
