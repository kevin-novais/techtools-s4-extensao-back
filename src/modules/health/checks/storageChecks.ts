/**
 * DTZ-320 - check do Google Cloud Storage. READ-ONLY: bucket.exists() faz apenas uma
 * consulta de metadados do bucket (nao cria, nao envia arquivo). Reusa a mesma
 * construcao emulator-aware do provider GCSStorage.
 */
import { Storage } from '@google-cloud/storage';
import { Config } from '@/config/config';
import { HealthCheck } from '@/modules/health/types/health.types';

export const storageChecks: HealthCheck[] = [
    {
        name: 'Integração s4-extensao-dotz / Google storage',
        category: 'storage',
        target: () => {
            const bucket = Config.GCS_BUCKET_NAME;
            if (!bucket) return 'nao configurado';
            return Config.GCS_EMULATOR_HOST
                ? `${Config.GCS_EMULATOR_HOST}/${bucket}`
                : `storage.googleapis.com/${bucket}`;
        },
        run: async () => {
            const bucket = Config.GCS_BUCKET_NAME;
            if (!bucket) {
                throw new Error('GCS_BUCKET_NAME não configurada');
            }
            const isEmulator = Boolean(Config.GCS_EMULATOR_HOST);

            const storage = new Storage({
                projectId: Config.GCS_PROJECT_ID || undefined,
                ...(isEmulator && { apiEndpoint: `http://${Config.GCS_EMULATOR_HOST}` }),
            });

            const [exists] = await storage.bucket(bucket).exists();
            if (!exists) {
                throw new Error(`bucket "${bucket}" respondeu, porém não existe/sem acesso`);
            }
            return { detail: 'bucket acessível (exists ok)' };
        },
    },
];
