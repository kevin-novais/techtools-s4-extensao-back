/**
 * DTZ-320 - check do RabbitMQ. READ-ONLY e sem efeito colateral: abre a conexao,
 * abre um canal e fecha os dois. NAO faz assertQueue nem consume - portanto nao cria
 * fila nem rouba mensagens dos sistemas produtivos que continuam ligados.
 */
import amqp from 'amqplib';
import { Config } from '@/config/config';
import { HealthCheck } from '@/modules/health/types/health.types';
import { hostPortFromUrl } from '@/modules/health/util/target';

export const messagingChecks: HealthCheck[] = [
    {
        name: 'RabbitMQ',
        category: 'messaging',
        target: () => hostPortFromUrl(Config.RABBITMQ_URL),
        run: async () => {
            if (!Config.RABBITMQ_URL) {
                throw new Error('RABBITMQ_URL não configurada');
            }
            const connection = await amqp.connect(Config.RABBITMQ_URL);
            try {
                const channel = await connection.createChannel();
                await channel.close();
            } finally {
                await connection.close();
            }
            return { detail: 'conexão + canal ok (sem consumir filas)' };
        },
    },
];
