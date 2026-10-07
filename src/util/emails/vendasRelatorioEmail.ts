import { render } from "@react-email/components";
import type { Attachment } from "nodemailer/lib/mailer";
import { VendasRelatorioEmail } from "@/util/emails/templates/VendasRelatorioEmail";
import { sendEmailWithHtmlAndAttachments, EmailSendResult } from "@/util/emails/clientEmail";
import { GCSStorage } from "@/providers/gcs-storage";
import path from "node:path";

// O bucket do GCS é privado (uniform_bucket_level_access, sem allUsers) — o nodemailer não
// tem credencial pra baixar a URL sozinho. Por isso o conteúdo é buscado aqui via SDK
// autenticado e anexado como bytes (content), nunca como link (path) pro storage.
function buildGcsAttachment(gcsStorage: GCSStorage, url: string, filename: string, contentType: string): Attachment {
    const blobName = gcsStorage.extractBlobNameFromUrl(url);
    return {
        filename,
        content: gcsStorage.createReadStream(blobName),
        contentType,
    };
}

function buildAnalyzerAttachment(
    gcsStorage: GCSStorage,
    url: string,
    filename: string,
): Attachment {
    let isManagedAnexo = false;
    try {
        isManagedAnexo = new URL(url).pathname.includes("/ANEXOS_VENDA/");
    } catch {
        isManagedAnexo = false;
    }

    if (!isManagedAnexo) {
        return { filename, path: url };
    }

    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".pdf"
        ? "application/pdf"
        : extension === ".xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/octet-stream";

    return buildGcsAttachment(gcsStorage, url, filename, contentType);
}

interface SendVendasRelatorioEmailProps {
    email: string;
    dataEmissao: string;
    dataVencimento: string;
    codigoBoleto: string;
    dotzEmailTrocas: string;
    dotzEmailContasReceber: string;
    telefoneContasReceber: string;
    relatorioPdfFilename: string;
    relatorioPdfPath: string;
    relatorioXlsxFilename: string;
    relatorioXlsxPath: string;
    boletoFilename?: string;
    boletoPath?: string;
    analyzerFaturaDetalhadaFilename?: string;
    analyzerFaturaDetalhadaPath?: string;
    analyzerRelatorioAnaliticoFilename?: string;
    analyzerRelatorioAnaliticoPath?: string;
}

export async function sendVendasRelatorioEmail({
    email,
    dataEmissao,
    dataVencimento,
    codigoBoleto,
    dotzEmailTrocas,
    dotzEmailContasReceber,
    telefoneContasReceber,
    relatorioPdfFilename,
    relatorioPdfPath,
    relatorioXlsxFilename,
    relatorioXlsxPath,
    boletoFilename,
    boletoPath,
    analyzerFaturaDetalhadaFilename,
    analyzerFaturaDetalhadaPath,
    analyzerRelatorioAnaliticoFilename,
    analyzerRelatorioAnaliticoPath,
}: SendVendasRelatorioEmailProps): Promise<EmailSendResult> {
    const emailHtml = await render(
        VendasRelatorioEmail({
            dataEmissao,
            dataVencimento,
            codigoBoleto,
            dotzEmailTrocas,
            dotzEmailContasReceber,
            telefoneContasReceber,
        })
    );

    const subject = "Fatura de Vendas Dotz";
    const gcsStorage = new GCSStorage();

    const attachments: Attachment[] = [
        buildGcsAttachment(gcsStorage, relatorioPdfPath, relatorioPdfFilename, "application/pdf"),
        buildGcsAttachment(
            gcsStorage,
            relatorioXlsxPath,
            relatorioXlsxFilename,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    ];

    if (boletoPath && boletoFilename) {
        attachments.push(buildGcsAttachment(gcsStorage, boletoPath, boletoFilename, "application/pdf"));
    }

    if (analyzerFaturaDetalhadaPath && analyzerFaturaDetalhadaFilename) {
        attachments.push(
            buildAnalyzerAttachment(
                gcsStorage,
                analyzerFaturaDetalhadaPath,
                analyzerFaturaDetalhadaFilename,
            ),
        );
    }

    if (analyzerRelatorioAnaliticoPath && analyzerRelatorioAnaliticoFilename) {
        attachments.push(
            buildAnalyzerAttachment(
                gcsStorage,
                analyzerRelatorioAnaliticoPath,
                analyzerRelatorioAnaliticoFilename,
            ),
        );
    }

    return sendEmailWithHtmlAndAttachments(email, subject, emailHtml, attachments);
}
