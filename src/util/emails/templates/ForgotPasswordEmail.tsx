import * as React from "react";
import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Heading,
    Hr,
    Link,
} from "@react-email/components";

interface ForgotPasswordEmailProps {
    readonly nome: string;
    readonly resetLink: string;
    readonly expirationMinutes: number;
}

export function ForgotPasswordEmail({
    nome,
    resetLink,
    expirationMinutes,
}: ForgotPasswordEmailProps) {
    return (
        <Html lang="pt-BR">
            <Head />
            <Body style={main}>
                <Container style={container}>
                    <Section style={content}>
                        <Heading style={heading}>Recuperação de Senha</Heading>

                        <Text style={paragraph}>
                            Olá <strong>{nome}</strong>,
                        </Text>

                        <Text style={paragraph}>
                            Recebemos uma solicitação para redefinir a senha da
                            sua conta no S4 Extensão Dotz.
                        </Text>

                        <Text style={paragraph}>
                            Para criar uma nova senha, clique no botão abaixo:
                        </Text>

                        <Section style={buttonContainer}>
                            <Link href={resetLink} style={button}>
                                Redefinir Minha Senha
                            </Link>
                        </Section>

                        <Section style={warningSection}>
                            <Text style={warningText}>
                                <strong>⚠️ ATENÇÃO:</strong> Este link expira em{" "}
                                <strong>{expirationMinutes} minutos</strong> e
                                pode ser usado apenas uma vez.
                            </Text>
                        </Section>

                        <Text style={paragraph}>
                            Se o botão não funcionar, copie e cole o link abaixo
                            no seu navegador:
                        </Text>

                        <Section style={linkBox}>
                            <Text style={linkText}>{resetLink}</Text>
                        </Section>

                        <Hr style={hr} />

                        <Section style={securitySection}>
                            <Text style={securityTitle}>
                                🔒 Dicas de Segurança
                            </Text>
                            <Text style={securityText}>
                                • Nunca compartilhe este link com ninguém
                            </Text>
                            <Text style={securityText}>
                                • Certifique-se de estar no site oficial
                            </Text>
                            <Text style={securityText}>
                                • Use uma senha forte e única
                            </Text>
                        </Section>

                        <Hr style={hr} />

                        <Text style={footer}>
                            Se você não solicitou a redefinição de senha, ignore
                            este email. Sua senha permanecerá inalterada e
                            segura.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

// Estilos
const main = {
    backgroundColor: "#f6f9fc",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px 0 48px",
    marginBottom: "64px",
    maxWidth: "600px",
};

const content = {
    padding: "0 48px",
};

const heading = {
    fontSize: "24px",
    lineHeight: "1.3",
    fontWeight: "700",
    color: "#121212",
    margin: "0 0 24px",
    textAlign: "center" as const,
};

const paragraph = {
    fontSize: "16px",
    lineHeight: "1.5",
    color: "#525f7f",
    margin: "16px 0",
};

const buttonContainer = {
    textAlign: "center" as const,
    margin: "32px 0",
};

const button = {
    backgroundColor: "#121212",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 32px",
};

const warningSection = {
    backgroundColor: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: "8px",
    padding: "16px",
    margin: "24px 0",
};

const warningText = {
    fontSize: "14px",
    lineHeight: "1.5",
    color: "#856404",
    margin: "0",
};

const linkBox = {
    backgroundColor: "#f6f9fc",
    border: "1px solid #e6ebf1",
    borderRadius: "8px",
    padding: "16px",
    margin: "16px 0",
    wordBreak: "break-all" as const,
};

const linkText = {
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#525f7f",
    margin: "0",
    fontFamily: "monospace",
};

const securitySection = {
    backgroundColor: "#f6f9fc",
    border: "1px solid #e6ebf1",
    borderRadius: "8px",
    padding: "20px",
    margin: "24px 0",
};

const securityTitle = {
    fontSize: "16px",
    fontWeight: "600",
    color: "#121212",
    margin: "0 0 12px",
};

const securityText = {
    fontSize: "14px",
    lineHeight: "1.8",
    color: "#525f7f",
    margin: "4px 0",
};

const hr = {
    borderColor: "#e6ebf1",
    margin: "32px 0",
};

const footer = {
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#8898aa",
    textAlign: "center" as const,
    margin: "0",
};
