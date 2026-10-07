import { Config } from '@/config/config';
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';


const emailPort = Number(Config.EMAIL_PORT);

const transporter = nodemailer.createTransport({
    host: Config.EMAIL_HOST,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
        user: Config.EMAIL_USER,
        pass: Config.EMAIL_PASSWORD,
    },
});

export default async function sendEmail(to: string, subject: string, text: string) {
    const mailOptions = {
        from: Config.EMAIL_FROM,
        to,
        subject,
        text,
    };
    await transporter.sendMail(mailOptions);
}

export async function sendEmailWithHtml(
    to: string,
    subject: string,
    html: string,
    text?: string
) {
    const mailOptions = {
        from: Config.EMAIL_FROM,
        to,
        subject,
        html,
        text: text || subject,
    };
    await transporter.sendMail(mailOptions);
}

export interface EmailSendResult {
    accepted: string[];
    rejected: string[];
}

export async function sendEmailWithHtmlAndAttachments(
    to: string,
    subject: string,
    html: string,
    attachments: Attachment[],
    text?: string
): Promise<EmailSendResult> {
    const mailOptions = {
        from: Config.EMAIL_FROM,
        to,
        subject,
        html,
        text: text || subject,
        attachments,
    };
    const info = await transporter.sendMail(mailOptions);

    return {
        accepted: info.accepted.map((address) => (typeof address === "string" ? address : address.address)),
        rejected: info.rejected.map((address) => (typeof address === "string" ? address : address.address)),
    };
}