import type { CoverageOptions } from "vitest/node";

/**
 * Configuração compartilhada de coverage entre vitest.config.ts (unit)
 * e vitest.integration.config.ts (integration).
 *
 * Use `reportsDirectory` distinto por suite via parâmetro.
 */
export function buildCoverageConfig(reportsDirectory: string): CoverageOptions {
    return {
        provider: "v8",
        reportsDirectory,
        reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
        all: true,
        include: ["src/**/*.ts"],
        exclude: [
            "src/index.ts",
            "src/app.ts",
            "src/queue/workers.ts",
            "src/cli/**",
            "src/cron/index.ts",
            "src/cron/jobs/**",
            "src/database/clients/**",
            "src/database/DatabaseManager.ts",
            "src/config/**",
            "src/@types/**",
            "src/util/emails/templates/**",
            "src/queue/types/**",
            "src/queue/config/**",
            "src/middlewares/cors.ts",
            "src/middlewares/request-logger.ts",
            "src/middlewares/error-handling.ts",
            "src/util/logger.ts",
            "src/providers/**",
            "**/*.types.ts",
            "**/*.d.ts",
            "**/index.ts",
            "tests/**",
            "dist/**",
            "node_modules/**",
            "prisma/**",
            "scripts/**",
        ],
        thresholds: {
            // Sem thresholds rígidos por enquanto — habilite quando coverage estabilizar.
            // lines: 70, functions: 70, branches: 60, statements: 70,
        },
        clean: true,
    };
}
