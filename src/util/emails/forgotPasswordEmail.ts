import { render } from '@react-email/components';
import { ForgotPasswordEmail } from '@/util/emails/templates/ForgotPasswordEmail';
import { sendEmailWithHtml } from '@/util/emails/clientEmail';

interface SendForgotPasswordEmailProps {
  nome: string;
  email: string;
  resetLink: string;
  expirationMinutes: number;
}

export async function sendForgotPasswordEmail({
  nome,
  email,
  resetLink,
  expirationMinutes,
}: SendForgotPasswordEmailProps) {
  const emailHtml = await render(
    ForgotPasswordEmail({
      nome,
      resetLink,
      expirationMinutes,
    })
  );

  const subject = 'Recuperação de Senha - S4 Extensão Dotz';

  await sendEmailWithHtml(email, subject, emailHtml);
}

