import { spawnSync } from "node:child_process";
import path from "node:path";
import sql from "mssql";

const SCHEMA_PATH = path.resolve(process.cwd(), "prisma/s4_extensao_dotz/schema.prisma");

function parseSqlServerUrl(connectionString: string): {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
} {
    const url = connectionString.replace("sqlserver://", "");
    const [hostPart, ...paramParts] = url.split(";");
    const [server, portStr] = hostPart.split(":");

    const params = paramParts.reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split("=");
        if (k && v !== undefined) acc[k.trim().toLowerCase()] = v.trim();
        return acc;
    }, {});

    return {
        server,
        port: portStr ? Number(portStr) : 1433,
        database: params.database ?? "",
        user: params.user ?? "sa",
        password: params.password ?? "",
    };
}

async function ensureDatabaseExists(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida em .env.test");

    const parsed = parseSqlServerUrl(connectionString);
    if (!parsed.database) throw new Error("DATABASE_URL não contém parâmetro 'database'");

    const masterPool = await sql.connect({
        server: parsed.server,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        database: "master",
        options: { encrypt: true, trustServerCertificate: true },
    });

    try {
        const safeName = parsed.database.replace(/[^A-Za-z0-9_]/g, "");
        if (safeName !== parsed.database) {
            throw new Error(`Nome de database inseguro: ${parsed.database}`);
        }
        await masterPool.request().query(
            `IF DB_ID('${safeName}') IS NULL CREATE DATABASE [${safeName}]`,
        );
    } finally {
        await masterPool.close();
    }
}

function runPrismaMigrateDeploy(): void {
    const prismaBin = require.resolve("prisma/build/index.js");
    const result = spawnSync(
        process.execPath,
        [prismaBin, "migrate", "deploy", `--schema=${SCHEMA_PATH}`],
        { stdio: "inherit", env: process.env, shell: false },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`prisma migrate deploy falhou (exit ${result.status})`);
    }
}

export async function setup(): Promise<void> {
    console.log("[integration] Garantindo que o banco de testes exista...");
    await ensureDatabaseExists();

    console.log("[integration] Aplicando migrations Prisma...");
    runPrismaMigrateDeploy();

    console.log("[integration] Banco de testes pronto.");
}

export async function teardown(): Promise<void> {
    // Conexões Prisma são fechadas no afterAll do setup file de cada execução.
}
