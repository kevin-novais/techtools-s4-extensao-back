import dotenv from "dotenv";
import path from "node:path";
import { vi } from "vitest";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.NODE_ENV = "development";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";

// Evita side effects de logger em imports durante testes unitários.
vi.mock("@/util/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
