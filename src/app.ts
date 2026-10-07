import "express-async-errors";
import express, { type Express } from "express";
import corsMiddleware from "@/middlewares/cors";
import { errorHandling } from "@/middlewares/error-handling";
import { requestLogger } from "@/middlewares/request-logger";
import { router } from "@/routes";
import { Config } from "@/config/config";
import healthRoutes from "@/modules/health/routes/health.routes";

export function createApp(): Express {
    const app = express();

    app.use(express.json());
    app.use(corsMiddleware);
    app.use(requestLogger);

    // DTZ-320: health check disponível sempre. No modo HEALTH_CHECK_ONLY a app sobe
    // apenas para validar infra (virada produtiva) e NÃO monta as rotas de negócio,
    // garantindo que não execute nenhuma operação que afete produção.
    app.use(healthRoutes);
    if (!Config.HEALTH_CHECK_ONLY) {
        app.use(router);
    }

    app.use(errorHandling);

    return app;
}
