import { Request, Response, NextFunction } from 'express';
import log from '@/util/logger';

/**
 * Middleware para registrar logs de requisições HTTP
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = req;
    const statusCode = res.statusCode;
    const payload = {
      method,
      originalUrl,
      statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    };

    if (statusCode >= 500) {
      log.error('[HTTP] Request finalizada com erro do servidor', payload);
      return;
    }

    if (statusCode >= 400) {
      log.warn('[HTTP] Request finalizada com erro de cliente', payload);
      return;
    }

    log.http('[HTTP] Request finalizada com sucesso', payload);
  });

  next();
};

