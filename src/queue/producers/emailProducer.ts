import { rabbitmqConnection, QUEUES } from '@/queue/config/rabbitmq';
import {
    EmailType,
    WelcomeEmailMessage,
    ForgotPasswordEmailMessage,
    FornecedorRelatorioEmailMessage,
    VendasRelatorioEmailMessage,
} from '@/queue/types/emailQueue.types';

interface PublishVendasRelatorioEmailProps {
    vendasHeaderId: number;
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
import log from '@/util/logger';

interface PublishWelcomeEmailProps {
    nome: string;
    email: string;
    senha: string;
    appUrl: string;
}

interface PublishForgotPasswordEmailProps {
    nome: string;
    email: string;
    resetLink: string;
    expirationMinutes: number;
}

interface PublishFornecedorRelatorioEmailProps {
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

export async function publishWelcomeEmail(props: PublishWelcomeEmailProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: WelcomeEmailMessage = {
            type: EmailType.WELCOME,
            timestamp: new Date(),
            data: props,
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.EMAIL, messageBuffer, {
            persistent: true, // Mensagem sobrevive a restart do RabbitMQ
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Email de boas-vindas publicado na fila para: ${props.email}`);
    } catch (error) {
        log.error('Erro ao publicar email de boas-vindas na fila: %o', error);
        throw error;
    }
}

export async function publishForgotPasswordEmail(props: PublishForgotPasswordEmailProps): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: ForgotPasswordEmailMessage = {
            type: EmailType.FORGOT_PASSWORD,
            timestamp: new Date(),
            data: props,
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.EMAIL, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Email de recuperação de senha publicado na fila para: ${props.email}`);
    } catch (error) {
        log.error('Erro ao publicar email de recuperação de senha na fila: %o', error);
        throw error;
    }
}

export async function publishFornecedorRelatorioEmail(
    props: PublishFornecedorRelatorioEmailProps
): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: FornecedorRelatorioEmailMessage = {
            type: EmailType.FORNECEDOR_RELATORIO,
            timestamp: new Date(),
            data: props,
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.EMAIL, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Email de relatorio do fornecedor publicado na fila para: ${props.email}`);
    } catch (error) {
        log.error('Erro ao publicar email de relatorio do fornecedor na fila: %o', error);
        throw error;
    }
}

export async function publishVendasRelatorioEmail(
    props: PublishVendasRelatorioEmailProps
): Promise<void> {
    try {
        const channel = await rabbitmqConnection.getChannel();

        const message: VendasRelatorioEmailMessage = {
            type: EmailType.VENDAS_RELATORIO,
            timestamp: new Date(),
            data: props,
        };

        const messageBuffer = Buffer.from(JSON.stringify(message));

        channel.sendToQueue(QUEUES.EMAIL, messageBuffer, {
            persistent: true,
            headers: {
                'x-retry-count': 0,
            },
        });

        log.info(`Email de relatorio de vendas publicado na fila para: ${props.email}`);
    } catch (error) {
        log.error('Erro ao publicar email de relatorio de vendas na fila: %o', error);
        throw error;
    }
}

