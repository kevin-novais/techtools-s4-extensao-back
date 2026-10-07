import { describe, expect, it } from "vitest";
import { testAgent, authenticatedAgent } from "../helpers/server";
import { createUsuario, createCia } from "../helpers/factories";
import { getTestPrisma } from "../helpers/db";

describe("CIA - smoke integração", () => {
    it("GET /cia sem auth retorna 401", async () => {
        const response = await testAgent().get("/cia");
        expect(response.status).toBe(401);
    });

    it("factory createCia persiste no banco isolado", async () => {
        const prisma = getTestPrisma();
        const admin = await createUsuario({ perfil: "ADMIN" });

        const cia = await createCia({
            nome: "CIA Teste Smoke",
            atualizadoPor: admin.id,
        });

        expect(cia.id).toBeGreaterThan(0);

        const count = await prisma.cia.count();
        expect(count).toBe(1);
    });

    it("POST /cia autenticado cria CIA com 200", async () => {
        const admin = await createUsuario({ perfil: "ADMIN" });
        const agent = authenticatedAgent({ userId: admin.id, perfil: "ADMIN" });

        const response = await agent.post("/cia").send({
            nome: "CIA Criada Via API",
            ciaIdSAP: "9001",
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            message: expect.stringContaining("sucesso"),
            cia: expect.objectContaining({ nome: "CIA Criada Via API" }),
        });

        const prisma = getTestPrisma();
        const persisted = await prisma.cia.findFirst({ where: { nome: "CIA Criada Via API" } });
        expect(persisted).not.toBeNull();
    });
});
