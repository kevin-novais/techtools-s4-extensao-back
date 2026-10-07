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

interface WelcomeEmailProps {
    readonly nome: string;
    readonly email: string;
    readonly senha: string;
    readonly appUrl: string;
}

export function WelcomeEmail({
    nome,
    email,
    senha,
    appUrl,
}: WelcomeEmailProps) {
    return (
        <Html lang="pt-BR">
            <Head />
            <Body style={main}>
                <Container style={container}>
                    <Section style={content}>
                        <Heading style={heading}>
                            Bem-vindo(a) ao S4 Extensão Dotz!
                        </Heading>

                        <Text style={paragraph}>
                            Olá <strong>{nome}</strong>,
                        </Text>

                        <Text style={paragraph}>
                            Sua conta foi criada com sucesso! Estamos felizes em
                            tê-lo(a) conosco.
                        </Text>

                        <Section style={passwordSection}>
                            <Text style={passwordLabel}>
                                Sua senha de acesso:
                            </Text>
                            <Section style={passwordBox}>
                                <Text style={passwordText}>{senha}</Text>
                            </Section>
                        </Section>

                        <Section style={warningSection}>
                            <Text style={warningText}>
                                <strong>⚠️ IMPORTANTE:</strong> Esta é uma senha
                                gerada automaticamente. Por segurança,
                                recomendamos que você altere sua senha no
                                primeiro acesso.
                            </Text>
                        </Section>

                        <Text style={paragraph}>
                            Para acessar o sistema, utilize as seguintes
                            credenciais:
                        </Text>

                        <Section style={credentialsBox}>
                            <Text style={credentialsText}>
                                <strong>Email:</strong> {email}
                            </Text>
                            <Text style={credentialsText}>
                                <strong>Senha:</strong> {senha}
                            </Text>
                        </Section>

                        <Section style={buttonContainer}>
                            <Link href={appUrl} style={button}>
                                Acessar Sistema
                            </Link>
                        </Section>

                        <Hr style={hr} />

                        <Text style={footer}>
                            Se você não solicitou esta conta, por favor, ignore
                            este email.
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

const passwordSection = {
    margin: "24px 0",
};

const passwordLabel = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#525f7f",
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
};

const passwordBox = {
    backgroundColor: "#f6f9fc",
    border: "2px solid #e6ebf1",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center" as const,
    margin: "8px 0",
};

const passwordText = {
    fontSize: "20px",
    fontWeight: "700",
    color: "#121212",
    fontFamily: "monospace",
    letterSpacing: "2px",
    margin: "0",
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

const credentialsBox = {
    backgroundColor: "#f6f9fc",
    border: "1px solid #e6ebf1",
    borderRadius: "8px",
    padding: "20px",
    margin: "24px 0",
};

const credentialsText = {
    fontSize: "14px",
    lineHeight: "1.8",
    color: "#525f7f",
    margin: "8px 0",
    fontFamily: "monospace",
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
