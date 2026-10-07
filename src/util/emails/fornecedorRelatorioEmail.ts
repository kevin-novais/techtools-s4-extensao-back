import { GCSStorage } from "@/providers/gcs-storage";
import { sendEmailWithHtmlAndAttachments } from "@/util/emails/clientEmail";
import { FornecedorRelatorioEmail } from "@/util/emails/templates/FornecedorRelatorioEmail";
import { render } from "@react-email/components";
import type { Attachment } from "nodemailer/lib/mailer";

// O bucket do GCS é privado (uniform_bucket_level_access, sem allUsers) — o nodemailer não
// tem credencial pra baixar a URL sozinho. Por isso o conteúdo é buscado aqui via SDK
// autenticado e anexado como bytes (content), nunca como link (path) pro storage.
function buildGcsAttachment(gcsStorage: GCSStorage, url: string, filename: string, contentType: string): Attachment {
    return {
        filename,
        content: gcsStorage.createReadStream(url),
        contentType,
    };
}

interface SendFornecedorRelatorioEmailProps {
    email: string;
    dataEmissao: string;
    dataVencimento: string;
    dotzEmailTrocas: string;
    dotzEmailContasReceber: string;
    telefoneContasReceber: string;
    relatorioPdfFilename: string;
    relatorioPdfPath: string;
    relatorioXlsxFilename: string;
    relatorioXlsxPath: string;
}

export async function sendFornecedorRelatorioEmail({
    email,
    dataEmissao,
    dataVencimento,
    dotzEmailTrocas,
    dotzEmailContasReceber,
    telefoneContasReceber,
    relatorioPdfFilename,
    relatorioPdfPath,
    relatorioXlsxFilename,
    relatorioXlsxPath,
}: SendFornecedorRelatorioEmailProps) {
    const emailHtml = await render(
        FornecedorRelatorioEmail({
            dataEmissao,
            dataVencimento,
            dotzEmailTrocas,
            dotzEmailContasReceber,
            telefoneContasReceber,
        })
    );

    const subject = "Relatório de Trocas POS Dotz";
    const gcsStorage = new GCSStorage();

    await sendEmailWithHtmlAndAttachments(email, subject, emailHtml, [
            buildGcsAttachment(gcsStorage, relatorioPdfPath, relatorioPdfFilename, "application/pdf"),
            buildGcsAttachment(gcsStorage, relatorioXlsxPath, relatorioXlsxFilename,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        ]
    );
}
