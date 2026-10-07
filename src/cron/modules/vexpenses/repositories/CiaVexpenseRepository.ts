/**
 * Resolve a CIA interna (cia.id) a partir do codigoCia do VExpenses
 * (parameters.base = cia.ciaIdSAP / CompanyCode no S/4, ex.: "0401").
 */
import s4DotzClient from "@/database/clients/s4DotzClient";

export class CiaVexpenseRepository {
    /** @returns cia.id interno, ou null se vazio/não cadastrado. */
    async resolverCiaId(codigoCia: string | null): Promise<number | null> {
        if (!codigoCia) return null;
        const cia = await s4DotzClient.cia.findFirst({
            where: { ciaIdSAP: codigoCia, deletadoEm: null },
            select: { id: true },
        });
        return cia?.id ?? null;
    }
}
