/**
 * DTZ-320 - app Express minimo, só com as rotas de health. Usado pelo container
 * consumer (workers), que hoje não sobe HTTP; assim o health check existe nos DOIS
 * containers. O container da API monta as mesmas rotas no app principal (ver app.ts).
 */
import 'express-async-errors';
import express, { type Express } from 'express';
import { errorHandling } from '@/middlewares/error-handling';
import healthRoutes from '@/modules/health/routes/health.routes';

export function createHealthApp(): Express {
    const app = express();
    app.use(express.json());
    app.use(healthRoutes);
    app.use(errorHandling);
    return app;
}
