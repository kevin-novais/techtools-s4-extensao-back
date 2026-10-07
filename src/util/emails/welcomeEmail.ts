import { render } from '@react-email/components';
import { WelcomeEmail } from '@/util/emails/templates/WelcomeEmail';
import { sendEmailWithHtml } from '@/util/emails/clientEmail';

interface SendWelcomeEmailProps {
  nome: string;
  email: string;
  senha: string;
  appUrl: string;
}

export async function sendWelcomeEmail({
  nome,
  email,
  senha,
  appUrl,
}: SendWelcomeEmailProps) {
  const emailHtml = await render(
    WelcomeEmail({
      nome,
      email,
      senha,
      appUrl,
    })
  );

  const subject = 'Bem-vindo(a) ao S4 Extensão Dotz!';

  await sendEmailWithHtml(email, subject, emailHtml);
}

