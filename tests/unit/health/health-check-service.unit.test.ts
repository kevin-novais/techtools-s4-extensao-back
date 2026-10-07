import { describe, expect, it } from "vitest";
import { HealthCheckService } from "@/modules/health/HealthCheckService";
import type { HealthCheck } from "@/modules/health/types/health.types";
import { hostPortFromUrl, hostPortFromSqlServerUrl } from "@/modules/health/util/target";

function okCheck(name: string, target = "host:1"): HealthCheck {
    return {
        name,
        category: "integration",
        target: () => target,
        run: async () => ({ detail: "ok" }),
    };
}

function failCheck(name: string, error: Error, target = "host:9"): HealthCheck {
    return {
        name,
        category: "integration",
        target: () => target,
        run: async () => {
            throw error;
        },
    };
}

describe("HealthCheckService (DTZ-320)", () => {
    it("status geral é 'ok' quando todos os checks passam", async () => {
        const report = await new HealthCheckService([okCheck("a"), okCheck("b")]).run();
        expect(report.status).toBe("ok");
        expect(report.summary).toEqual({ total: 2, ok: 2, fail: 0 });
    });

    it("status geral é 'fail' se qualquer check falha", async () => {
        const report = await new HealthCheckService([
            okCheck("a"),
            failCheck("b", new Error("caiu")),
        ]).run();
        expect(report.status).toBe("fail");
        expect(report.summary).toEqual({ total: 2, ok: 1, fail: 1 });
    });

    it("mostra o alvo (host:porta) MESMO quando o check falha", async () => {
        const report = await new HealthCheckService([
            failCheck("db", new Error("timeout"), "10.0.0.1:1433"),
        ]).run();
        const check = report.checks[0];
        expect(check.status).toBe("fail");
        expect(check.target).toBe("10.0.0.1:1433");
        expect(check.detail).toBe("timeout");
    });

    it("um check que estoura o timeout vira 'fail', não derruba o relatório", async () => {
        const lento: HealthCheck = {
            name: "lento",
            category: "integration",
            target: () => "host:1",
            timeoutMs: 20,
            run: () => new Promise(() => undefined), // nunca resolve
        };
        const report = await new HealthCheckService([lento]).run();
        expect(report.checks[0].status).toBe("fail");
        expect(report.checks[0].detail).toMatch(/timeout/i);
    });

    it("descreve erros de rede sem message (AggregateError) com os códigos", async () => {
        const agg = new AggregateError(
            [Object.assign(new Error(""), { code: "ECONNREFUSED" })],
            "",
        );
        const report = await new HealthCheckService([failCheck("rabbit", agg)]).run();
        expect(report.checks[0].detail).toContain("ECONNREFUSED");
    });
});

describe("target util (DTZ-320)", () => {
    it("extrai host:porta de URL http/https/amqp sem expor credencial", () => {
        expect(hostPortFromUrl("https://api.exemplo.com/x?y=1")).toBe("api.exemplo.com:443");
        expect(hostPortFromUrl("amqp://user:pass@rabbit:5672/%2F")).toBe("rabbit:5672");
        expect(hostPortFromUrl(undefined)).toBe("nao configurado");
    });

    it("extrai host:porta de connection string SQL Server do Prisma", () => {
        expect(
            hostPortFromSqlServerUrl("sqlserver://10.204.0.16:1433;database=s4;user=x;password=y"),
        ).toBe("10.204.0.16:1433");
        expect(hostPortFromSqlServerUrl("sqlserver://host;database=s4")).toBe("host:1433");
        expect(hostPortFromSqlServerUrl(undefined)).toBe("nao configurado");
    });
});
