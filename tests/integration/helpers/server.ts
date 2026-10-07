import request, { type SuperTest, type Test } from "supertest";
import type { Express } from "express";
import { createApp } from "../../../src/app";
import { signTestToken } from "./auth";

let cachedApp: Express | null = null;

export function buildTestApp(): Express {
    if (!cachedApp) {
        cachedApp = createApp();
    }
    return cachedApp;
}

export function testAgent(): SuperTest<Test> {
    return request(buildTestApp()) as unknown as SuperTest<Test>;
}

interface AuthAgentParams {
    userId: number;
    perfil?: "USER" | "ADMIN";
}

export function authenticatedAgent(params: AuthAgentParams) {
    const token = signTestToken({ id: params.userId, perfil: params.perfil });
    const agent = request(buildTestApp());

    return {
        get: (url: string) => agent.get(url).set("Authorization", `Bearer ${token}`),
        post: (url: string) => agent.post(url).set("Authorization", `Bearer ${token}`),
        put: (url: string) => agent.put(url).set("Authorization", `Bearer ${token}`),
        patch: (url: string) => agent.patch(url).set("Authorization", `Bearer ${token}`),
        delete: (url: string) => agent.delete(url).set("Authorization", `Bearer ${token}`),
    };
}
