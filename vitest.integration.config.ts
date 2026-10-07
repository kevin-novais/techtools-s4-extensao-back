import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { buildCoverageConfig } from "./vitest.coverage.shared";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@prisma/client-s4-dotz/runtime/library": path.resolve(
        __dirname,
        "node_modules/@prisma/client-s4-dotz/runtime/library.js",
      ),
      "@prisma/client-s4-dotz": path.resolve(
        __dirname,
        "node_modules/@prisma/client-s4-dotz/index.js",
      ),
      "@prisma/client-dotz-stage": path.resolve(
        __dirname,
        "node_modules/@prisma/client-dotz-stage/index.js",
      ),
      "@prisma/relatorio-readonly-client": path.resolve(
        __dirname,
        "node_modules/@prisma/relatorio-readonly-client/index.js",
      ),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./tests/setup/integration.global-setup.ts"],
    setupFiles: ["./tests/setup/integration.setup.ts"],
    include: ["tests/integration/**/*.integration.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    clearMocks: true,
    restoreMocks: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    server: {
      deps: {
        inline: [/@prisma\/client-s4-dotz/, /@prisma\/client-dotz-stage/, /@prisma\/relatorio-readonly-client/],
      },
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    passWithNoTests: false,
    coverage: buildCoverageConfig("coverage/integration"),
  },
});
