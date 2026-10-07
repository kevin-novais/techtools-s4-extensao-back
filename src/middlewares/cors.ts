import cors from 'cors';
import { Config } from '@/config/config';
import AppError from '@/util/AppError';

const normalizeOrigin = (origin: string): string => {
  return origin.replace(/\/$/, ''); 
};

const allowedOrigins = (Config.CORS_ORIGIN || '')
  .split(',')
  .map(origin => normalizeOrigin(origin.trim()))
  .filter(origin => origin.length > 0);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permitir requisições sem origin (Postman, apps mobile, etc)
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(new AppError('Origem não permitida', 403));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  // Sem isso o navegador bloqueia a leitura do header no front (só expõe o
  // safelist padrão do CORS), e o nome/extensão real do arquivo se perde.
  exposedHeaders: ['Content-Disposition'],
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;


