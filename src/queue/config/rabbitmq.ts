import amqp, { type Connection, type Channel } from 'amqplib';
import { Config } from '@/config/config';
import log from '@/util/logger';

export const QUEUES = {
    EMAIL: 'email.queue',
    EMAIL_DLQ: 'email.dlq',
    DOCUMENTO_FISCAL: 'documento-fiscal.queue',
    DOCUMENTO_FISCAL_DLQ: 'documento-fiscal.dlq',
    SAP_INTEGRATION: 'sap-integration.queue',
    SAP_INTEGRATION_DLQ: 'sap-integration.dlq',
    VEXPENSES_INTEGRATION: 'vexpenses-integration.queue',
    VEXPENSES_INTEGRATION_DLQ: 'vexpenses-integration.dlq',
    VENDAS_INTEGRATION: 'vendas-integration.queue',
    VENDAS_INTEGRATION_DLQ: 'vendas-integration.dlq',
    VENDA_REC_DIFERIDA_INTEGRATION: 'venda-rec-diferida-integration.queue',
    VENDA_REC_DIFERIDA_INTEGRATION_DLQ: 'venda-rec-diferida-integration.dlq',
    VENDA_REC_DIFERIDA_REVERSAO: 'venda-rec-diferida-reversao.queue',
    VENDA_REC_DIFERIDA_REVERSAO_DLQ: 'venda-rec-diferida-reversao.dlq',
} as const;

export const EXCHANGES = {
    EMAIL_DLX: 'email.dlx',
    DOCUMENTO_FISCAL_DLX: 'documento-fiscal.dlx',
    SAP_INTEGRATION_DLX: 'sap-integration.dlx',
    VEXPENSES_INTEGRATION_DLX: 'vexpenses-integration.dlx',
    VENDAS_INTEGRATION_DLX: 'vendas-integration.dlx',
    VENDA_REC_DIFERIDA_INTEGRATION_DLX: 'venda-rec-diferida-integration.dlx',
    VENDA_REC_DIFERIDA_REVERSAO_DLX: 'venda-rec-diferida-reversao.dlx',
} as const;

class RabbitMQConnection {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private isConnecting = false;

    async connect(): Promise<void> {
        if (this.connection && this.channel) {
            return;
        }

        if (this.isConnecting) {
            // Aguarda a conexão em andamento
            while (this.isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        this.isConnecting = true;

        try {
            log.info('Conectando ao RabbitMQ...');
            this.connection = await amqp.connect(Config.RABBITMQ_URL) as any as Connection;
            this.channel = await (this.connection as any).createChannel();

            // Configurar Dead Letter Exchange
            await this.channel!.assertExchange(EXCHANGES.EMAIL_DLX, 'direct', {
                durable: true,
            });

            // Configurar Dead Letter Queue
            await this.channel!.assertQueue(QUEUES.EMAIL_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.EMAIL_DLQ,
                EXCHANGES.EMAIL_DLX,
                QUEUES.EMAIL
            );

            // Configurar fila principal com DLX e retry
            await this.channel!.assertQueue(QUEUES.EMAIL, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.EMAIL_DLX,
                    'x-dead-letter-routing-key': QUEUES.EMAIL,
                },
            });

            // Configurar Dead Letter Exchange para Documento Fiscal
            await this.channel!.assertExchange(EXCHANGES.DOCUMENTO_FISCAL_DLX, 'direct', {
                durable: true,
            });

            // Configurar Dead Letter Queue para Documento Fiscal
            await this.channel!.assertQueue(QUEUES.DOCUMENTO_FISCAL_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.DOCUMENTO_FISCAL_DLQ,
                EXCHANGES.DOCUMENTO_FISCAL_DLX,
                QUEUES.DOCUMENTO_FISCAL
            );

            // Configurar fila principal de Documento Fiscal
            await this.channel!.assertQueue(QUEUES.DOCUMENTO_FISCAL, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.DOCUMENTO_FISCAL_DLX,
                    'x-dead-letter-routing-key': QUEUES.DOCUMENTO_FISCAL,
                },
            });

            // Configurar Dead Letter Exchange para SAP Integration
            await this.channel!.assertExchange(EXCHANGES.SAP_INTEGRATION_DLX, 'direct', {
                durable: true,
            });

            // Configurar Dead Letter Queue para SAP Integration
            await this.channel!.assertQueue(QUEUES.SAP_INTEGRATION_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.SAP_INTEGRATION_DLQ,
                EXCHANGES.SAP_INTEGRATION_DLX,
                QUEUES.SAP_INTEGRATION
            );

            // Configurar fila principal de SAP Integration
            await this.channel!.assertQueue(QUEUES.SAP_INTEGRATION, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.SAP_INTEGRATION_DLX,
                    'x-dead-letter-routing-key': QUEUES.SAP_INTEGRATION,
                },
            });

            // Configurar Dead Letter Exchange para Vexpenses Integration
            await this.channel!.assertExchange(EXCHANGES.VEXPENSES_INTEGRATION_DLX, 'direct', {
                durable: true,
            });

            // Configurar Dead Letter Queue para Vexpenses Integration
            await this.channel!.assertQueue(QUEUES.VEXPENSES_INTEGRATION_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.VEXPENSES_INTEGRATION_DLQ,
                EXCHANGES.VEXPENSES_INTEGRATION_DLX,
                QUEUES.VEXPENSES_INTEGRATION
            );

            // Configurar fila principal de Vexpenses Integration
            await this.channel!.assertQueue(QUEUES.VEXPENSES_INTEGRATION, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.VEXPENSES_INTEGRATION_DLX,
                    'x-dead-letter-routing-key': QUEUES.VEXPENSES_INTEGRATION,
                },
            });

            // Configurar Dead Letter Exchange para Vendas Integration
            await this.channel!.assertExchange(EXCHANGES.VENDAS_INTEGRATION_DLX, 'direct', {
                durable: true,
            });

            // Configurar Dead Letter Queue para Vendas Integration
            await this.channel!.assertQueue(QUEUES.VENDAS_INTEGRATION_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.VENDAS_INTEGRATION_DLQ,
                EXCHANGES.VENDAS_INTEGRATION_DLX,
                QUEUES.VENDAS_INTEGRATION
            );

            // Configurar fila principal de Vendas Integration
            await this.channel!.assertQueue(QUEUES.VENDAS_INTEGRATION, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.VENDAS_INTEGRATION_DLX,
                    'x-dead-letter-routing-key': QUEUES.VENDAS_INTEGRATION,
                },
            });

            // Configurar Dead Letter Exchange para VendaRecDiferida Integration
            await this.channel!.assertExchange(EXCHANGES.VENDA_REC_DIFERIDA_INTEGRATION_DLX, 'direct', {
                durable: true,
            });

            await this.channel!.assertQueue(QUEUES.VENDA_REC_DIFERIDA_INTEGRATION_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.VENDA_REC_DIFERIDA_INTEGRATION_DLQ,
                EXCHANGES.VENDA_REC_DIFERIDA_INTEGRATION_DLX,
                QUEUES.VENDA_REC_DIFERIDA_INTEGRATION,
            );

            await this.channel!.assertQueue(QUEUES.VENDA_REC_DIFERIDA_INTEGRATION, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.VENDA_REC_DIFERIDA_INTEGRATION_DLX,
                    'x-dead-letter-routing-key': QUEUES.VENDA_REC_DIFERIDA_INTEGRATION,
                },
            });

            // Configurar Dead Letter Exchange para VendaRecDiferida Reversão
            await this.channel!.assertExchange(EXCHANGES.VENDA_REC_DIFERIDA_REVERSAO_DLX, 'direct', {
                durable: true,
            });

            await this.channel!.assertQueue(QUEUES.VENDA_REC_DIFERIDA_REVERSAO_DLQ, {
                durable: true,
            });

            await this.channel!.bindQueue(
                QUEUES.VENDA_REC_DIFERIDA_REVERSAO_DLQ,
                EXCHANGES.VENDA_REC_DIFERIDA_REVERSAO_DLX,
                QUEUES.VENDA_REC_DIFERIDA_REVERSAO,
            );

            await this.channel!.assertQueue(QUEUES.VENDA_REC_DIFERIDA_REVERSAO, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': EXCHANGES.VENDA_REC_DIFERIDA_REVERSAO_DLX,
                    'x-dead-letter-routing-key': QUEUES.VENDA_REC_DIFERIDA_REVERSAO,
                },
            });

            log.info('Conectado ao RabbitMQ com sucesso');

            // Handlers para eventos de conexão
            this.connection.on('error', (err) => {
                log.error('Erro na conexão RabbitMQ: %o', err);
            });

            this.connection.on('close', () => {
                log.warn('Conexão RabbitMQ fechada');
                this.connection = null;
                this.channel = null;
            });
        } catch (error) {
            log.error('Erro ao conectar ao RabbitMQ: %o', error);
            this.connection = null;
            this.channel = null;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async getChannel(): Promise<Channel> {
        if (!this.channel) {
            await this.connect();
        }

        if (!this.channel) {
            throw new Error('Não foi possível estabelecer conexão com RabbitMQ');
        }

        return this.channel;
    }

    async disconnect(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if (this.connection) {
                await (this.connection as any).close();
                this.connection = null;
            }

            log.info('Desconectado do RabbitMQ');
        } catch (error) {
            log.error('Erro ao desconectar do RabbitMQ: %o', error);
        }
    }

    isConnected(): boolean {
        return this.connection !== null && this.channel !== null;
    }
}

// Exportar instância singleton
export const rabbitmqConnection = new RabbitMQConnection();

