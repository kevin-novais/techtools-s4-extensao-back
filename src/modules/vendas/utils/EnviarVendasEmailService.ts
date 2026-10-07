import path from "node:path";
import log from "@/util/logger";
import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import { publishVendasRelatorioEmail } from "@/queue/producers/emailProducer";
import { Config } from "@/config/config";
import { formatDateOnly } from "@/util/date";
import { formatTelefone } from "@/util/formatters/telefone";
import AppError from "@/util/AppError";

interface EnviarVendasEmailParams {
    vendasHeaderId: number;
}

function filenameFromUrl(value: string): string {
    try {
        return path.basename(new URL(value).pathname);
    } catch {
        return path.basename(value);
    }
}

export class EnviarVendasEmailService {
    async execute(params: EnviarVendasEmailParams): Promise<void> {
        const { vendasHeaderId } = params;

        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: {
                id: true,
                ciaIdSAP: true,
                codigoClienteSAP: true,
                dataEmissao: true,
                dataVencimento: true,
                relatorioPdf: true,
                relatorioXlsx: true,
                pathBoleto: true,
                codigoBoleto: true,
                pathArquivoFaturaDetalhadaAnalyzer: true,
                pathArquivoRelatorioAnalitico: true,
            },
        });

        if (!venda) {
            throw new AppError(`Venda ${vendasHeaderId} não encontrada`, 404);
        }

        if (!venda.codigoClienteSAP) {
            throw new AppError(`Venda ${vendasHeaderId} sem código de cliente SAP`, 400);
        }

        const fornecedor = await dotzStageClient().oCRD.findUnique({
            where: { CardCode: venda.codigoClienteSAP },
            select: { email: true },
        });

        if (!fornecedor?.email) {
            throw new AppError(
                `Fornecedor ${venda.codigoClienteSAP} sem email cadastrado (venda=${vendasHeaderId})`,
                400,
            );
        }

        // Validar relatorio PDF
        if (!venda.relatorioPdf) {
            throw new AppError(`Venda ${vendasHeaderId} sem relatório PDF gerado`, 400);
        }

        // Validar relatorio XLSX
        if (!venda.relatorioXlsx) {
            throw new AppError(`Venda ${vendasHeaderId} sem relatório XLSX gerado`, 400);
        }

        const relatorioPdfPath = venda.relatorioPdf;
        const relatorioXlsxPath = venda.relatorioXlsx;

        // Resolver boleto (opcional mas esperado)
        let boletoFilename: string | undefined;
        let boletoPath: string | undefined;

        if (venda.pathBoleto) {
            boletoPath = venda.pathBoleto;
            boletoFilename = filenameFromUrl(venda.pathBoleto);
        }

        // Registros legados podem conter URLs externas; novos anexos são armazenados no GCS.
        let analyzerFaturaDetalhadaFilename: string | undefined;
        let analyzerFaturaDetalhadaPath: string | undefined;

        if (venda.pathArquivoFaturaDetalhadaAnalyzer) {
            analyzerFaturaDetalhadaPath = venda.pathArquivoFaturaDetalhadaAnalyzer;
            analyzerFaturaDetalhadaFilename = filenameFromUrl(venda.pathArquivoFaturaDetalhadaAnalyzer);
        }

        let analyzerRelatorioAnaliticoFilename: string | undefined;
        let analyzerRelatorioAnaliticoPath: string | undefined;

        if (venda.pathArquivoRelatorioAnalitico) {
            analyzerRelatorioAnaliticoPath = venda.pathArquivoRelatorioAnalitico;
            analyzerRelatorioAnaliticoFilename = filenameFromUrl(venda.pathArquivoRelatorioAnalitico);
        }

        // Buscar CIA para telefone
        const cia = await this.fetchCiaByCiaIdSAP(venda.ciaIdSAP);

        const dataEmissao = venda.dataEmissao ? formatDateOnly(venda.dataEmissao) : "N/A";
        const dataVencimento = venda.dataVencimento ? formatDateOnly(venda.dataVencimento) : "N/A";
        const telefoneContasReceber = cia?.telefone ? formatTelefone(cia.telefone) : "N/A";

        await publishVendasRelatorioEmail({
            vendasHeaderId,
            email: fornecedor.email,
            dataEmissao,
            dataVencimento,
            codigoBoleto: venda.codigoBoleto || "N/A",
            dotzEmailTrocas: Config.DOTZ_EMAIL_TROCAS || "N/A",
            dotzEmailContasReceber: Config.DOTZ_EMAIL_CONTAS_RECEBER || "N/A",
            telefoneContasReceber,
            relatorioPdfFilename: filenameFromUrl(venda.relatorioPdf),
            relatorioPdfPath,
            relatorioXlsxFilename: filenameFromUrl(venda.relatorioXlsx),
            relatorioXlsxPath,
            boletoFilename,
            boletoPath,
            analyzerFaturaDetalhadaFilename,
            analyzerFaturaDetalhadaPath,
            analyzerRelatorioAnaliticoFilename,
            analyzerRelatorioAnaliticoPath,
        });

        log.info(
            `[EnviarVendasEmailService] Email de vendas enfileirado para fornecedor ${venda.codigoClienteSAP} (${fornecedor.email}), venda=${vendasHeaderId}`
        );
    }

    private async fetchCiaByCiaIdSAP(ciaId: string) {
        try {
            return await s4DotzClient.cia.findFirst({
                where: {
                    ciaIdSAP: ciaId,
                    deletadoEm: null,
                },
                select: {
                    telefone: true,
                },
            });
        } catch (error) {
            log.error("[EnviarVendasEmailService] Erro ao buscar CIA: %o", error);
            return null;
        }
    }
}
