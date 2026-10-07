/**
 * DTZ-320 - checks das integracoes externas. Todos READ-ONLY:
 *  - SAP / XTPG / Invent: exercem autenticacao ou consulta de metadados (WSDL). O
 *    login OAuth/token e um POST no endpoint de AUTENTICACAO - nao grava nenhum dado
 *    de negocio; e o minimo para provar que a porta esta liberada E a credencial vale.
 *  - Vexpense: GET de leitura leve.
 *  - Accountfy: integracao de ENTRADA (o Accountfy chama nosso webhook). Nao ha URL
 *    de saida; validamos que a APP_API_KEY (auth do webhook) esta configurada - o
 *    caminho de dados do webhook e o BD s4, ja coberto pelo check de banco.
 */
import axios from 'axios';
import https from 'node:https';
import { Config } from '@/config/config';
import { HealthCheck } from '@/modules/health/types/health.types';
import { hostPortFromUrl } from '@/modules/health/util/target';
import { S4HanaCloudAuthenticationTokenService } from '@/util/services/auth-sap/AuthenticationTokenService';

/** TLS relaxado só nas integrações que já usam certificado não verificado no código atual. */
const insecureAgent = new https.Agent({ rejectUnauthorized: false });
const DEFAULT_TIMEOUT = 8000;

export const integrationChecks: HealthCheck[] = [
    {
        name: 'Integração s4-extensao-dotz / SAP',
        category: 'integration',
        target: () => hostPortFromUrl(Config.S4_HANA_CLOUD_AUTH_URL),
        run: async () => {
            if (!Config.S4_HANA_CLOUD_AUTH_URL) {
                throw new Error('S4_HANA_CLOUD_AUTH_URL não configurada');
            }
            const auth = await new S4HanaCloudAuthenticationTokenService().execute({
                grant_type: Config.S4_HANA_CLOUD_GRANT_TYPE || '',
                client_id: Config.S4_HANA_CLOUD_CLIENT_ID || '',
                client_secret: Config.S4_HANA_CLOUD_CLIENT_SECRET || '',
            });
            if (!auth?.access_token) {
                throw new Error('endpoint de auth respondeu sem access_token');
            }
            return { detail: 'token OAuth obtido' };
        },
    },
    {
        name: 'Integração s4-extensao-dotz / XTPG',
        category: 'integration',
        target: () => hostPortFromUrl(Config.XTPG_API_BASE_URL),
        run: async () => {
            const base = Config.XTPG_API_BASE_URL;
            if (!base) {
                throw new Error('XTPG_API_BASE_URL não configurada');
            }
            const url = `${base}${Config.XTPG_API_ENDPOINT}?WSDL`;
            const res = await axios.get(url, {
                timeout: DEFAULT_TIMEOUT,
                httpsAgent: insecureAgent,
                validateStatus: (s) => s > 0,
            });
            if (res.status >= 400) {
                throw new Error(`HTTP ${res.status} ao consultar o WSDL`);
            }
            return { detail: `WSDL respondeu HTTP ${res.status} (sem enviar movimento)` };
        },
    },
    {
        name: 'Integração s4-extensao-dotz / Invent',
        category: 'integration',
        target: () => hostPortFromUrl(Config.BANKPLUS_INVENT_BASE_URL),
        run: async () => {
            const base = Config.BANKPLUS_INVENT_BASE_URL;
            if (!base) {
                throw new Error('BANKPLUS_INVENT_BASE_URL não configurada');
            }
            const httpsAgent = new https.Agent({ rejectUnauthorized: process.env.NODE_ENV === 'production' });
            const res = await axios.create({
                baseURL: base,
                headers: {
                    Aplicacao: Config.BANKPLUS_INVENT_APLICACAO,
                    TenantId: Config.BANKPLUS_INVENT_TENANT_ID,
                    'Content-Type': 'application/json',
                },
                httpsAgent,
            }).post(
                '/authenticate',
                { username: Config.BANKPLUS_INVENT_USERNAME, Password: Config.BANKPLUS_INVENT_PASSWORD },
                { timeout: DEFAULT_TIMEOUT, validateStatus: (s) => s > 0 },
            );
            if (res.status >= 400) {
                throw new Error(`HTTP ${res.status} no /authenticate`);
            }
            return { detail: 'authenticate ok' };
        },
    },
    {
        name: 'Integração s4-extensao-dotz / Vexpense',
        category: 'integration',
        target: () => hostPortFromUrl(Config.VEXPENSES_BASE_URL),
        run: async () => {
            const base = Config.VEXPENSES_BASE_URL;
            if (!base) {
                throw new Error('VEXPENSES_BASE_URL não configurada');
            }
            const res = await axios.create({
                baseURL: base,
                headers: { Authorization: Config.VEXPENSES_TOKEN_API, 'Content-Type': 'application/json' },
            }).get('/team-members', { timeout: DEFAULT_TIMEOUT, validateStatus: (s) => s > 0 });
            if (res.status >= 400) {
                throw new Error(`HTTP ${res.status} em /team-members`);
            }
            return { detail: `GET /team-members HTTP ${res.status}` };
        },
    },
    {
        name: 'Integração s4-extensao-dotz / Accountfy',
        category: 'integration',
        target: () => 'webhook de entrada: GET /webhooks/accountfy/registros-contabeis',
        run: async () => {
            // Entrada: o Accountfy consome GET /webhooks/accountfy/registros-contabeis,
            // protegido por APP_API_KEY e servido a partir do BD s4 (já checado acima).
            if (!Config.APP_API_KEY) {
                throw new Error('APP_API_KEY não configurada (autenticação do webhook de entrada)');
            }
            return { detail: 'APP_API_KEY configurada; dados servidos via BD s4-extensao-dotz' };
        },
    },
];
