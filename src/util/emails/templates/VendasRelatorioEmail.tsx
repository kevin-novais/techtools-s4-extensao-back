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

interface VendasRelatorioEmailProps {
    readonly dataEmissao: string;
    readonly dataVencimento: string;
    readonly codigoBoleto: string;
    readonly dotzEmailTrocas: string;
    readonly dotzEmailContasReceber: string;
    readonly telefoneContasReceber: string;
}

export function VendasRelatorioEmail({
    dataEmissao,
    dataVencimento,
    codigoBoleto,
    dotzEmailTrocas,
    dotzEmailContasReceber,
    telefoneContasReceber,
}: VendasRelatorioEmailProps) {
    return (
        <Html lang="pt-BR">
            <Head />
            <Body style={main}>
                <Container style={container}>
                    <Section style={content}>
                        <Heading style={heading}>
                            Fatura de Vendas Dotz
                        </Heading>

                        <Text style={paragraph}>Prezado Parceiro,</Text>

                        <Text style={paragraph}>
                            Segue anexo a fatura referente as vendas de pontos
                            Dotz realizadas em seu(s) estabelecimento(s) com
                            data de emissao em {dataEmissao}.
                        </Text>

                        <Text style={paragraph}>
                            O vencimento desta fatura esta programado para o
                            dia {dataVencimento}.
                        </Text>

                        <Text style={paragraph}>
                            Boleto para pagamento: <strong>{codigoBoleto}</strong>
                        </Text>

                        <Text style={paragraph}>
                            Em anexo voce encontrara o relatorio detalhado, a
                            fatura detalhada, o relatorio analitico e o boleto
                            para pagamento.
                        </Text>

                        <Text style={paragraph}>
                            Eventuais divergencias deverao ser ajustadas no
                            fechamento do proximo mes.
                        </Text>

                        <Text style={paragraph}>
                            Em caso de duvidas, estamos a disposicao atraves do
                            e-mail:
                        </Text>

                        <Text style={paragraph}>{dotzEmailTrocas}</Text>

                        <Hr style={hr} />

                        <Text style={subtitle}>IMPORTANTE:</Text>

                        <Text style={paragraph}>
                            Caso nosso setor de Contas a Receber identifique
                            alguma inadimplencia do favorecido, o pagamento
                            deste fechamento sera suspenso ate que a
                            regularizacao seja realizada.
                        </Text>

                        <Text style={paragraph}>
                            Por isso, certifique-se de que todos os boletos das
                            faturas enviadas pela Dotz foram devidamente pagos.
                        </Text>

                        <Text style={paragraph}>
                            Se houver pendencias de faturas em aberto ou
                            duvidas, favor entrar em contato com nosso setor de
                            Contas a Receber atraves dos canais abaixo:
                        </Text>

                        <Text style={paragraph}>
                            E-mail: {dotzEmailContasReceber}
                        </Text>

                        <Text style={paragraph}>
                            Telefone: {telefoneContasReceber}
                        </Text>

                        <Text style={paragraph}>Obrigado,</Text>

                        <Hr style={hr} />

                        <Text style={footer}>
                            Este e-mail foi gerado automaticamente. Por favor,
                            nao responder.
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
