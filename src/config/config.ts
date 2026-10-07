import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export class Config {

    public static readonly APP_API_KEY = process.env.APP_API_KEY;

    public static readonly PORT = process.env.PORT || 8574;

    public static readonly APP_URL = process.env.APP_URL || `http://localhost:${Config.PORT}`;

    public static readonly API_URL = process.env.API_URL || `http://localhost:${Config.PORT}`;

    public static readonly CORS_ORIGIN = process.env.CORS_ORIGIN;

    public static readonly ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || '';

    public static readonly ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || '15d';

    public static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

    public static readonly RESET_PASSWORD_TOKEN_EXPIRATION_MINUTES = 30;

    // Database Pool
    public static readonly DATABASE_CONNECTION_LIMIT = Number(process.env.DATABASE_CONNECTION_LIMIT) || 50;
    public static readonly DATABASE_POOL_TIMEOUT = Number(process.env.DATABASE_POOL_TIMEOUT) || 20;

    // RabbitMQ
    public static readonly RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
    public static readonly RABBITMQ_PREFETCH = Number(process.env.RABBITMQ_PREFETCH) || 1;
    public static readonly RABBITMQ_PREFETCH_DOCUMENTO = Number(process.env.RABBITMQ_PREFETCH_DOCUMENTO) || 1;
    public static readonly RABBITMQ_PREFETCH_SAP = Number(process.env.RABBITMQ_PREFETCH_SAP) || 1;
    public static readonly RABBITMQ_PREFETCH_VENDAS = Number(process.env.RABBITMQ_PREFETCH_VENDAS) || 1;

    // Email
    public static readonly EMAIL_HOST = process.env.EMAIL_HOST;
    public static readonly EMAIL_PORT = process.env.EMAIL_PORT;
    public static readonly EMAIL_USER = process.env.EMAIL_USER;
    public static readonly EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
    public static readonly EMAIL_FROM = process.env.EMAIL_FROM;

    // Storage
    public static readonly BASE_STORAGE_FOLDER = process.env.BASE_STORAGE_FOLDER || path.resolve(__dirname, '..', '..', 'storage');

    // Google Cloud Storage
    public static readonly GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || '';
    public static readonly GCS_PROJECT_ID = process.env.GCS_PROJECT_ID || '';
    public static readonly GCS_EMULATOR_HOST = process.env.GCS_EMULATOR_HOST || '';
    public static readonly GCS_ROMANEIO_SUBFOLDER = process.env.GCS_ROMANEIO_SUBFOLDER || 'troca/romaneio';
    public static readonly GCS_POS_SUBFOLDER = process.env.GCS_POS_SUBFOLDER || 'troca/pos';

    // S4 HANA Cloud
    public static readonly S4_HANA_CLOUD_BASE_URL = process.env.S4_HANA_CLOUD_BASE_URL;
    public static readonly S4_HANA_CLOUD_AUTH_URL = process.env.S4_HANA_CLOUD_AUTH_URL;
    public static readonly S4_HANA_CLOUD_CLIENT_ID = process.env.S4_HANA_CLOUD_CLIENT_ID;
    public static readonly S4_HANA_CLOUD_CLIENT_SECRET = process.env.S4_HANA_CLOUD_CLIENT_SECRET;
    public static readonly S4_HANA_CLOUD_GRANT_TYPE = process.env.S4_HANA_CLOUD_GRANT_TYPE;
    public static readonly S4_HANA_CLOUD_USER_NAME = process.env.S4_HANA_CLOUD_USER_NAME || '';

    // Cron 
    public static readonly CRON_SYNC_SAP_PARTNERS = process.env.CRON_SYNC_SAP_PARTNERS || '0 9 * * *'; // todas os dias às 09:00
    public static readonly DAYS_TO_SYNC_SAP_PARTNERS = Number(process.env.DAYS_TO_SYNC_SAP_PARTNERS) || 2;
    public static readonly CRON_SYNC_SAP_PARTNERS_ENABLED = process.env.CRON_SYNC_SAP_PARTNERS_ENABLED === 'true';
    public static readonly CRON_SYNC_REGISTROS_CONTABEIS = process.env.CRON_SYNC_REGISTROS_CONTABEIS || '0 */3 * * *'; // cada 3 horas
    public static readonly CRON_SYNC_REGISTROS_CONTABEIS_ENABLED =
        process.env.CRON_SYNC_REGISTROS_CONTABEIS_ENABLED === 'true';
    public static readonly SYNC_REGISTROS_CONTABEIS_PAGE_SIZE =
        Number(process.env.SYNC_REGISTROS_CONTABEIS_PAGE_SIZE) || 100;
    public static readonly CRON_PROCESS_VENDAS_PENDENTES =
        process.env.CRON_PROCESS_VENDAS_PENDENTES || '*/30 * * * *'; // cada 30 minutos
    public static readonly CRON_PROCESS_VENDAS_PENDENTES_ENABLED =
        process.env.CRON_PROCESS_VENDAS_PENDENTES_ENABLED === 'true';
    public static readonly CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER =
        process.env.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER || '*/30 * * * *'; // cada 30 minutos
    public static readonly CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_ENABLED =
        process.env.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_ENABLED === 'true';
    public static readonly CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_BATCH_SIZE =
        Number(process.env.CRON_PROCESS_VENDAS_INTEGRACAO_ANALIZER_BATCH_SIZE) || 100;
    public static readonly CRON_ENVIAR_VENDAS_EMAIL =
        process.env.CRON_ENVIAR_VENDAS_EMAIL || '*/15 * * * *'; // cada 15 minutos
    public static readonly CRON_ENVIAR_VENDAS_EMAIL_ENABLED =
        process.env.CRON_ENVIAR_VENDAS_EMAIL_ENABLED === 'true';
    public static readonly CRON_CONSULTAR_BOLETO =
        process.env.CRON_CONSULTAR_BOLETO || '*/15 * * * *'; // cada 15 minutos
    public static readonly CRON_CONSULTAR_BOLETO_ENABLED =
        process.env.CRON_CONSULTAR_BOLETO_ENABLED === 'true';

    public static readonly CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES =
        process.env.CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES || '0 * * * *'; // cada hora
    public static readonly CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES_ENABLED =
        process.env.CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES_ENABLED === 'true';
    public static readonly CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO =
        process.env.CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO || '30 * * * *'; // cada hora, 30min offset
    public static readonly CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO_ENABLED =
        process.env.CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO_ENABLED === 'true';

    public static readonly RABBITMQ_PREFETCH_VENDA_REC_DIFERIDA =
        Number(process.env.RABBITMQ_PREFETCH_VENDA_REC_DIFERIDA) || 1;
    public static readonly CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP =
        process.env.CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP || '15 */3 * * *'; // 15min após o sync de registros contábeis
    public static readonly CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP_ENABLED =
        process.env.CRON_DETECT_VENDA_REC_DIFERIDA_REVERSAO_SAP_ENABLED === 'true';

    // (DTZ-279) Detecção de cancelamento de troca no SAP (reabre pedidos + cancela romaneio)
    public static readonly CRON_DETECT_TROCA_REVERSAO_SAP =
        process.env.CRON_DETECT_TROCA_REVERSAO_SAP || '20 */3 * * *'; // 20min após o sync de registros contábeis
    public static readonly CRON_DETECT_TROCA_REVERSAO_SAP_ENABLED =
        process.env.CRON_DETECT_TROCA_REVERSAO_SAP_ENABLED === 'true';

    // Logs
    public static readonly LOG_LEVEL = process.env.LOG_LEVEL || 'info';
    public static readonly LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
    public static readonly LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d';
    public static readonly LOG_ZIPPED_ARCHIVE = process.env.LOG_ZIPPED_ARCHIVE === 'true';

    // Upload
    public static readonly MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 100;

    // EMAILS DOTZ
    public static readonly DOTZ_EMAIL_TROCAS = process.env.DOTZ_EMAIL_TROCAS || '';
    public static readonly DOTZ_EMAIL_CONTAS_RECEBER = process.env.DOTZ_EMAIL_CONTAS_RECEBER || '';

    // Relatorio read-only
    public static readonly RELATORIO_READONLY_DATABASE_URL = process.env.RELATORIO_READONLY_DATABASE_URL || '';
    public static readonly RELATORIO_ALLOWED_DATABASES: string[] = (process.env.RELATORIO_ALLOWED_DATABASES || '')
        .split(',')
        .map((db) => db.trim().toLowerCase())
        .filter(Boolean);

    // Vexpense
    public static readonly VEXPENSES_BASE_URL = process.env.VEXPENSES_BASE_URL || '';
    public static readonly VEXPENSES_TOKEN_API = process.env.VEXPENSES_TOKEN_API || '';
    public static readonly VEXPENSES_DIAS_PASSADOS = Number(process.env.VEXPENSES_DIAS_PASSADOS) || 7; // 7 dias passados
    public static readonly CRON_VEXPENSES_APPROVED_REPORTS =
        process.env.CRON_VEXPENSES_APPROVED_REPORTS || '0 20 * * 5'; // todas as quintas-feiras às 20:00
    public static readonly CRON_VEXPENSES_APPROVED_REPORTS_ENABLED =
        process.env.CRON_VEXPENSES_APPROVED_REPORTS_ENABLED === 'true';
    public static readonly CRON_VEXPENSES_PAYMENT_BY_CLEARING =
        process.env.CRON_VEXPENSES_PAYMENT_BY_CLEARING || '0 */2 * * *'; // cada 2 horas
    public static readonly CRON_VEXPENSES_PAYMENT_BY_CLEARING_ENABLED =
        process.env.CRON_VEXPENSES_PAYMENT_BY_CLEARING_ENABLED === 'true';

    /** Classificação automática XTPG (item de fluxo de caixa em registros contábeis) */
    public static readonly CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG =
        process.env.CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG || '0 */6 * * *';
    public static readonly CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED =
        process.env.CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED === 'true';
    public static readonly CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE = Number(
        process.env.CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE || 500,
    );

    // XTPG Envio (integração DeepXRT - SendPrev / SendFlux)
    /** Base URL da API DeepXRT (ex.: https://apih.deepxrtbr.com.br homolog / https://apic.deepxrtbr.com.br prod) */
    public static readonly XTPG_API_BASE_URL = process.env.XTPG_API_BASE_URL || 'https://apih.deepxrtbr.com.br';
    /** Endpoint SOAP de entrada (EnviarListaMovimentoCaixaAssinc) */
    public static readonly XTPG_API_ENDPOINT = process.env.XTPG_API_ENDPOINT || '/dotz/SOAP_API/ITF/Entrada.asmx';
    /** Credenciais do ValidationSoapHeader (preencher conforme ambiente) */
    public static readonly XTPG_API_USUARIO = process.env.XTPG_API_USUARIO || '';
    public static readonly XTPG_API_SENHA = process.env.XTPG_API_SENHA || '';
    /** Timeout (ms) das chamadas SOAP */
    public static readonly XTPG_API_TIMEOUT_MS = Number(process.env.XTPG_API_TIMEOUT_MS) || 120000;
    /** Fonte das views: 's4' (s4_extensao_dotz) ou 'stage' (dotz-stage). Views reais estão em s4. */
    public static readonly XTPG_VIEW_DATASOURCE = (process.env.XTPG_VIEW_DATASOURCE || 's4').toLowerCase();
    /** Nomes das views de origem (já filtram por status_para_envio is null) */
    public static readonly XTPG_VIEW_PREVISTO = process.env.XTPG_VIEW_PREVISTO || 'XRT_SendPrevPagto';
    public static readonly XTPG_VIEW_REALIZADO = process.env.XTPG_VIEW_REALIZADO || 'XRT_SendFlux';

    /** Cron SendPrev (envio previsto) */
    public static readonly CRON_XTPG_SEND_PREV = process.env.CRON_XTPG_SEND_PREV || '0 */4 * * *';
    public static readonly CRON_XTPG_SEND_PREV_ENABLED = process.env.CRON_XTPG_SEND_PREV_ENABLED === 'true';
    /** Qtd de movimentos (DETAIL) por requisição (lote) no envio previsto */
    public static readonly XTPG_SEND_PREV_BATCH_SIZE = Number(process.env.XTPG_SEND_PREV_BATCH_SIZE) || 50;
    /** Qtd máxima de movimentos lidos da view por execução do cron previsto (0 = sem limite) */
    public static readonly XTPG_SEND_PREV_MAX_PER_RUN = Number(process.env.XTPG_SEND_PREV_MAX_PER_RUN) || 0;

    /** Cron SendFlux (envio realizado / fluxo) */
    public static readonly CRON_XTPG_SEND_FLUX = process.env.CRON_XTPG_SEND_FLUX || '0 */4 * * *';
    public static readonly CRON_XTPG_SEND_FLUX_ENABLED = process.env.CRON_XTPG_SEND_FLUX_ENABLED === 'true';
    /** Qtd de movimentos (DETAIL) por requisição (lote) no envio realizado */
    public static readonly XTPG_SEND_FLUX_BATCH_SIZE = Number(process.env.XTPG_SEND_FLUX_BATCH_SIZE) || 50;
    /** Qtd máxima de movimentos lidos da view por execução do cron realizado (0 = sem limite) */
    public static readonly XTPG_SEND_FLUX_MAX_PER_RUN = Number(process.env.XTPG_SEND_FLUX_MAX_PER_RUN) || 0;

    // XTPG Saída (DeepXRT Saida.asmx -> LCM no S/4)
    /** Base URL da API DeepXRT p/ Saída (default = mesma da entrada, homolog) */
    public static readonly XTPG_SAIDA_API_BASE_URL =
        process.env.XTPG_SAIDA_API_BASE_URL || process.env.XTPG_API_BASE_URL || 'https://apih.deepxrtbr.com.br';
    /** Endpoint SOAP de saída (ListarMovimentosContabeisPeloStatus / MudarStatusMovimentoParContabil) */
    public static readonly XTPG_SAIDA_API_ENDPOINT =
        process.env.XTPG_SAIDA_API_ENDPOINT || '/dotz/SOAP_API/ITF/Saida.asmx';
    /** Status consultado em ListarMovimentosContabeisPeloStatus (legado B1 = 'I') */
    public static readonly XTPG_SAIDA_STATUS_BUSCA = process.env.XTPG_SAIDA_STATUS_BUSCA || 'I';
    /** Status devolvido ao XTPG no sucesso / erro (legado B1 = 'C' / 'E') */
    public static readonly XTPG_SAIDA_STATUS_SUCESSO = process.env.XTPG_SAIDA_STATUS_SUCESSO || 'C';
    public static readonly XTPG_SAIDA_STATUS_ERRO = process.env.XTPG_SAIDA_STATUS_ERRO || 'E';
    // Obs.: tipoArApGl / tipoDocumento / textoDocumento do LCM vêm da tabela
    // configuracao_contabil_header (tipoProcesso XTPG_R), não de variáveis de ambiente.
    /** Cron de processamento da Saída */
    public static readonly CRON_XTPG_SAIDA = process.env.CRON_XTPG_SAIDA || '0 */4 * * *';
    public static readonly CRON_XTPG_SAIDA_ENABLED = process.env.CRON_XTPG_SAIDA_ENABLED === 'true';
    /**
     * Gate de segurança: só envia o LCM ao S/4 quando true. Default FALSE enquanto
     * o mapeamento da Saída está incompleto (centro de custo, tipo de documento e
     * contrato House Bank/TextoDetalhe pendentes – ver DTZ-227_Saida_XTPG_LCM_S4.md).
     */
    public static readonly XTPG_SAIDA_ENVIO_SAP_HABILITADO = process.env.XTPG_SAIDA_ENVIO_SAP_HABILITADO === 'true';

    // BankPlus Invent (cobrança / boletos)
    public static readonly BANKPLUS_INVENT_BASE_URL = process.env.BANKPLUS_INVENT_BASE_URL || '';
    public static readonly BANKPLUS_INVENT_USERNAME = process.env.BANKPLUS_INVENT_USERNAME || '';
    public static readonly BANKPLUS_INVENT_PASSWORD = process.env.BANKPLUS_INVENT_PASSWORD || '';
    public static readonly BANKPLUS_INVENT_APLICACAO = process.env.BANKPLUS_INVENT_APLICACAO || '8.BankPlus.Cobranca';
    public static readonly BANKPLUS_INVENT_TENANT_ID = process.env.BANKPLUS_INVENT_TENANT_ID || 'DOTZ';

    // Elasticsearch / ELK
    public static readonly ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || '';
    public static readonly ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY || '';
    public static readonly ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME || '';
    public static readonly ELASTICSEARCH_PASSWORD = process.env.ELASTICSEARCH_PASSWORD || '';
    public static readonly ELASTICSEARCH_INDEX_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'logs-dotz-s4';

    // Elastic APM
    public static readonly ELASTIC_APM_SERVER_URL = process.env.ELASTIC_APM_SERVER_URL || '';
    public static readonly ELASTIC_APM_SECRET_TOKEN = process.env.ELASTIC_APM_SECRET_TOKEN || '';
    public static readonly ELASTIC_APM_SERVICE_NAME = process.env.ELASTIC_APM_SERVICE_NAME || 's4-extensao-dotz-api';

    // Health check (DTZ-320)
    /**
     * Liga o modo "APENAS health check": a app sobe só para validar acessos (virada
     * produtiva) e NÃO executa nada que afete produção - sem cron, sem consumir filas,
     * sem rotas de negócio. Default false.
     */
    public static readonly HEALTH_CHECK_ONLY = process.env.HEALTH_CHECK_ONLY === 'true';
    /** Porta do servidor HTTP mínimo de health no container consumer (workers). */
    public static readonly HEALTH_CHECK_PORT = Number(process.env.HEALTH_CHECK_PORT) || 8576;

}
