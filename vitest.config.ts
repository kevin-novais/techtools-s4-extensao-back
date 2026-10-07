import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { buildCoverageConfig } from "./vitest.coverage.shared";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.unit.test.ts"],
    exclude: ["tests/scripts/**", "node_modules/**", "dist/**"],
    clearMocks: true,
    restoreMocks: true,
    coverage: buildCoverageConfig("coverage/unit"),
  },
});
