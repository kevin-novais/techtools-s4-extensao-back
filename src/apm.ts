import 'dotenv/config';
import apm from 'elastic-apm-node';

const serverUrl = process.env.ELASTIC_APM_SERVER_URL;
const secretToken = process.env.ELASTIC_APM_SECRET_TOKEN;

if (serverUrl) {
    apm.start({
        serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 's4-extensao-dotz-api',
        serverUrl,
        secretToken,
        environment: process.env.ELASTIC_APM_ENVIRONMENT || process.env.NODE_ENV || 'production',
        active: true,
        captureBody: 'errors',
        errorOnAbortedRequests: true,
        transactionSampleRate: 1.0,
    });
}

export default apm;
