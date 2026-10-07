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
} from "@react-email/components";

interface FornecedorRelatorioEmailProps {
    readonly dataEmissao: string;
    readonly dataVencimento: string;
    readonly dotzEmailTrocas: string;
    readonly dotzEmailContasReceber: string;
    readonly telefoneContasReceber: string;
}

export function FornecedorRelatorioEmail({
    dataEmissao,
    dataVencimento,
    dotzEmailTrocas,
    dotzEmailContasReceber,
    telefoneContasReceber,
}: FornecedorRelatorioEmailProps) {
    return (
        <Html lang="pt-BR">
            <Head />
            <Body style={main}>
                <Container style={container}>
                    <Section style={content}>
                        <Heading style={heading}>
                            Fechamento Mensal de Trocas Dotz
                        </Heading>

                        <Text style={paragraph}>Prezado Parceiro,</Text>

                        <Text style={paragraph}>
                            Segue anexo o fechamento mensal contendo as trocas
                            Dotz realizadas em seu(s) estabelecimento(s) em{" "}
                            {dataEmissao}.
                        </Text>

                        <Text style={paragraph}>
                            O pagamento está programado para o dia{" "}
                            {dataVencimento}, através de depósito bancário em
                            sua conta corrente.
                        </Text>

                        <Text style={paragraph}>
                            Eventuais divergências deverão ser ajustadas no
                            fechamento do próximo mês.
                        </Text>

                        <Text style={paragraph}>
                            Em caso de dúvidas, estamos à disposição através do
                            e-mail:
                        </Text>

                        <Text style={paragraph}>{dotzEmailTrocas}</Text>

                        <Hr style={hr} />

                        <Text style={subtitle}>IMPORTANTE:</Text>

                        <Text style={paragraph}>
                            Caso nosso setor de Contas a Receber identifique
                            alguma inadimplência do favorecido, o pagamento
                            deste fechamento será suspenso até que a
                            regularização seja realizada.
                        </Text>

                        <Text style={paragraph}>
                            Por isso, certifique-se de que todos os boletos das
                            faturas enviadas pela Dotz foram devidamente pagos.
                        </Text>

                        <Text style={paragraph}>
                            Se houver pendências de faturas em aberto ou
                            dúvidas, favor entrar em contato com nosso setor de
                            Contas a Receber através dos canais abaixo:
                        </Text>

                        <Text style={paragraph}>
                            E-mail: {dotzEmailContasReceber}
                        </Text>

                        <Text style={paragraph}>Obrigado,</Text>

                        <Hr style={hr} />

                        <Text style={footer}>
                            Este e-mail foi gerado automaticamente. Por favor,
                            não responder.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

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

const subtitle = {
    fontSize: "16px",
    lineHeight: "1.5",
    fontWeight: "700",
    color: "#121212",
    margin: "16px 0",
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
