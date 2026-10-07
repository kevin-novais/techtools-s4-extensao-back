import type { Prisma } from '@prisma/client-s4-dotz';
import s4DotzClient from '@/database/clients/s4DotzClient';

type S4DotzClient = typeof s4DotzClient;

export async function buildRelatorioGrupoWhere(
    grupo?: string,
    client: S4DotzClient = s4DotzClient,
): Promise<Prisma.RelatorioWhereInput | undefined> {
    const trimmed = grupo?.trim();
    if (!trimmed) {
        return undefined;
    }

    const rows = await client.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM relatorio
        WHERE grupo IS NOT NULL
          AND LOWER(LTRIM(RTRIM(grupo))) = LOWER(${trimmed})
    `;

    const ids = rows.map((row: { id: number }) => row.id);
    if (ids.length === 0) {
        return { id: { in: [] } };
    }

    return { id: { in: ids } };
}
