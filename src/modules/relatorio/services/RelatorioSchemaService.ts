import DatabaseManager from '@/database/DatabaseManager';
import { Config } from '@/config/config';

interface ColumnSchema {
    name: string;
    type: string;
}

interface TableSchema {
    name: string;
    columns: ColumnSchema[];
}

interface DatabaseSchema {
    database: string;
    tables: TableSchema[];
}

interface ColumnRow {
    TABLE_NAME: string;
    COLUMN_NAME: string;
    DATA_TYPE: string;
}

export class RelatorioSchemaService {
    async execute(): Promise<DatabaseSchema[]> {
        const relatorioReadonlyClient = DatabaseManager.getRelatorioReadonlyClient();

        const results = await Promise.all(
            Config.RELATORIO_ALLOWED_DATABASES.map(async (db) => {
                const rows = (await relatorioReadonlyClient.$queryRawUnsafe(
                    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
                     FROM [${db}].INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME != '_prisma_migrations'
                     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
                )) as ColumnRow[];

                const tablesMap = new Map<string, ColumnSchema[]>();
                for (const row of rows) {
                    if (!tablesMap.has(row.TABLE_NAME)) {
                        tablesMap.set(row.TABLE_NAME, []);
                    }
                    tablesMap.get(row.TABLE_NAME)?.push({ name: row.COLUMN_NAME, type: row.DATA_TYPE });
                }

                return {
                    database: db,
                    tables: Array.from(tablesMap.entries()).map(([name, columns]) => ({ name, columns })),
                };
            }),
        );

        return results;
    }
}
