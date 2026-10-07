/**
 * DTZ-320 - check do ELK (Elasticsearch de logs/monitoramento). READ-ONLY: GET na
 * raiz do node, que devolve as infos do cluster. Mesma logica de auth do transport de
 * logs (winston-elasticsearch): apiKey se houver, senao usuario/senha.
 */
import axios from 'axios';
import https from 'node:https';
import { Config } from '@/config/config';
import { HealthCheck } from '@/modules/health/types/health.types';
import { hostPortFromUrl } from '@/modules/health/util/target';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

export const observabilityChecks: HealthCheck[] = [
    {
        name: 'Integração s4-extensao-dotz / ELK',
        category: 'observability',
        target: () => hostPortFromUrl(Config.ELASTICSEARCH_NODE),
        run: async () => {
            const node = Config.ELASTICSEARCH_NODE;
            if (!node) {
                throw new Error('ELASTICSEARCH_NODE não configurada');
            }

            const headers: Record<string, string> = {};
            let basicAuth: { username: string; password: string } | undefined;
            if (Config.ELASTICSEARCH_API_KEY) {
                headers.Authorization = `ApiKey ${Config.ELASTICSEARCH_API_KEY}`;
            } else if (Config.ELASTICSEARCH_USERNAME && Config.ELASTICSEARCH_PASSWORD) {
                basicAuth = { username: Config.ELASTICSEARCH_USERNAME, password: Config.ELASTICSEARCH_PASSWORD };
            }

            const res = await axios.get(node, {
                timeout: 8000,
                httpsAgent: insecureAgent,
                headers,
                auth: basicAuth,
                validateStatus: (s) => s > 0,
            });
            if (res.status >= 400) {
                throw new Error(`HTTP ${res.status} no node do Elasticsearch`);
            }
            return { detail: `ELK respondeu HTTP ${res.status}` };
        },
    },
];
