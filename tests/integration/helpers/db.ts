import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import DatabaseManager from "../../../src/database/DatabaseManager";

export function getTestPrisma() {
    return s4DotzClient;
}

interface TableRow {
    name: string;
}

let cachedTables: string[] | undefined;

async function listAppTables(): Promise<string[]> {
    if (cachedTables) return cachedTables;

    const rows = await s4DotzClient.$queryRawUnsafe<TableRow[]>(
        `SELECT t.name AS name
         FROM sys.tables t
         INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
         WHERE s.name = 'dbo' AND t.name <> '_prisma_migrations'`,
    );

    const tables = rows.map((r) => r.name);
    cachedTables = tables;
    return tables;
}

function quote(name: string): string {
    if (!/^\w+$/.test(name)) {
        throw new Error(`Nome de tabela inseguro: ${name}`);
    }
    return `[dbo].[${name}]`;
}

export async function truncateAll(): Promise<void> {
    const tables = await listAppTables();
    if (tables.length === 0) return;

    const disable = tables.map((t) => `ALTER TABLE ${quote(t)} NOCHECK CONSTRAINT ALL;`).join("\n");
    const deletes = tables.map((t) => `DELETE FROM ${quote(t)};`).join("\n");
    const reseed = tables
        .map(
            (t) =>
                `IF OBJECTPROPERTY(OBJECT_ID('${quote(t).replaceAll("'", "''")}'), 'TableHasIdentity') = 1
                    DBCC CHECKIDENT('${quote(t).replaceAll("'", "''")}', RESEED, 0) WITH NO_INFOMSGS;`,
        )
        .join("\n");
    const enable = tables.map((t) => `ALTER TABLE ${quote(t)} WITH CHECK CHECK CONSTRAINT ALL;`).join("\n");

    await s4DotzClient.$executeRawUnsafe(`
        ${disable}
        ${deletes}
        ${reseed}
        ${enable}
    `);
}

export const SYSTEM_USER_ID = 1;

export async function seedSystemUser(): Promise<void> {
    const exists = await s4DotzClient.usuario.findUnique({ where: { id: SYSTEM_USER_ID } });
    if (exists) return;

    await s4DotzClient.$executeRawUnsafe(`
        ALTER TABLE [dbo].[usuarios] NOCHECK CONSTRAINT ALL;
        SET IDENTITY_INSERT [dbo].[usuarios] ON;
        INSERT INTO [dbo].[usuarios] (id, email, nome, senha, perfil, ativo, atualizado_por, atualizado_em)
        VALUES (${SYSTEM_USER_ID}, 'system@test.local', 'System', 'x', 'ADMIN', 1, ${SYSTEM_USER_ID}, GETDATE());
        SET IDENTITY_INSERT [dbo].[usuarios] OFF;
        DBCC CHECKIDENT('[dbo].[usuarios]', RESEED, ${SYSTEM_USER_ID}) WITH NO_INFOMSGS;
        ALTER TABLE [dbo].[usuarios] WITH CHECK CHECK CONSTRAINT ALL;
    `);
}

export async function disconnect(): Promise<void> {
    await DatabaseManager.disconnectAll();
}
