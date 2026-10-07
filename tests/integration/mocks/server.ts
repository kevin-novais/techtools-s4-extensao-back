import { setupServer } from "msw/node";
import { allHandlers } from "./handlers";

const externalMode = process.env.RUN_EXTERNAL_INTEGRATION_TESTS === "true";

export const mswServer = setupServer(...allHandlers);

export function isMswEnabled(): boolean {
    return !externalMode;
}
