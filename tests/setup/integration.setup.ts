import { afterAll, afterEach, beforeEach } from "vitest";
import { mswServer, isMswEnabled } from "../integration/mocks/server";
import "../integration/mocks/queue";
import "../integration/mocks/email";
import { truncateAll, disconnect, seedSystemUser } from "../integration/helpers/db";

declare global {
    var __MSW_STARTED__: boolean | undefined;
}

function isLocalhostUrl(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    } catch {
        return false;
    }
}

if (isMswEnabled() && !globalThis.__MSW_STARTED__) {
    mswServer.listen({
        onUnhandledRequest(request, print) {
            if (isLocalhostUrl(request.url)) return;
            print.warning();
        },
    });
    globalThis.__MSW_STARTED__ = true;

    mswServer.events.on("request:start", ({ request }) => {
        if (process.env.MSW_DEBUG === "true") {
            console.log("[MSW] →", request.method, request.url);
        }
    });
}

beforeEach(async () => {
    await truncateAll();
    await seedSystemUser();
});

afterEach(() => {
    if (isMswEnabled()) {
        mswServer.resetHandlers();
    }
});

afterAll(async () => {
    await disconnect();
});
