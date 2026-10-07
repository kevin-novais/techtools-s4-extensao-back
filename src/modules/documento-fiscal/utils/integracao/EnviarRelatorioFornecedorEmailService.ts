import { Config } from "@/config/config";
import dotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { publishFornecedorRelatorioEmail } from "@/queue/producers/emailProducer";
import { formatDateOnly, formatMonthYear } from "@/util/date";
import { formatTelefone } from "@/util/formatters/telefone";
import log from "@/util/logger";

interface EnviarRelatorioFornecedorEmailParams {
    documentoFiscalHeaderId: number;
    codigoFornecedorSAP: string;
}

export class EnviarRelatorioFornecedorEmailService {
    async execute(params: EnviarRelatorioFornecedorEmailParams): Promise<void> {
        const { documentoFiscalHeaderId, codigoFornecedorSAP } = params;

        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: {
                codigoDocumento: true,
                dataEmissao: true,
                dataVencimento: true,
                posRelatorioPdfUrl: true,
                posRelatorioXlsxUrl: true,
                cia: {
                    select: {
                        telefone: true,
                    },
                },
            },
        });

        if (!documento) {
            throw new Error(
                `[EnviarRelatorioFornecedorEmailService] Documento ${documentoFiscalHeaderId} nao encontrado para envio de relatorio`
            );
        }

        const fornecedor = await dotzStageClient().oCRD.findUnique({
            where: { CardCode: codigoFornecedorSAP },
            select: {
                email: true,
            },
        });

        if (!fornecedor?.email) {
            throw new Error(
                `[EnviarRelatorioFornecedorEmailService] Fornecedor ${codigoFornecedorSAP} sem email cadastrado (documento=${documentoFiscalHeaderId})`
            );
        }

        const relatorioPdfFilename = this.extrairNomeArquivo(documento.posRelatorioPdfUrl);
        if (!relatorioPdfFilename) {
            throw new Error(
                `[EnviarRelatorioFornecedorEmailService] URL de relatorio PDF invalida (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP})`
            );
        }

        const relatorioXlsxFilename = this.extrairNomeArquivo(documento.posRelatorioXlsxUrl);
        if (!relatorioXlsxFilename) {
            throw new Error(
                `[EnviarRelatorioFornecedorEmailService] URL de relatorio XLSX invalida (documento=${documentoFiscalHeaderId}, fornecedor=${codigoFornecedorSAP})`
            );
        }

        const dataEmissao = documento.dataEmissao ? formatMonthYear(documento.dataEmissao) : "N/A";
        const dataVencimento = documento.dataVencimento ? formatDateOnly(documento.dataVencimento) : "N/A";
        const telefoneContasReceber = documento.cia?.telefone ? formatTelefone(documento.cia.telefone) : "";

        await publishFornecedorRelatorioEmail({
            email: fornecedor.email,
            dataEmissao,
            dataVencimento,
            dotzEmailTrocas: Config.DOTZ_EMAIL_TROCAS || "N/A",
            dotzEmailContasReceber: Config.DOTZ_EMAIL_CONTAS_RECEBER || "N/A",
            telefoneContasReceber,
            relatorioPdfFilename,
            relatorioPdfPath : documento.posRelatorioPdfUrl,
            relatorioXlsxFilename,
            relatorioXlsxPath : documento.posRelatorioXlsxUrl,
        });

        log.info(
            `[EnviarRelatorioFornecedorEmailService] Email de relatorio enfileirado para fornecedor ${codigoFornecedorSAP} (${fornecedor.email})`
        );
    }

    private extrairNomeArquivo(relatorioUrl: string): string | null {
        if (!relatorioUrl) {
            return null;
        }

        const partes = relatorioUrl.split("/");
        const filename = partes[partes.length - 1];
        return filename || null;
    }
}
