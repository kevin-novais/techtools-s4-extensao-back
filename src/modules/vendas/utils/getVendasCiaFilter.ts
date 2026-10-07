import s4DotzClient from "@/database/clients/s4DotzClient";

/**
 * Converte os IDs locais das CIAs do usuário para os ciaIdSAP
 * usados no VendasHeader.ciaIdSAP.
 *
 * VendasHeader.ciaIdSAP armazena o código SAP da CIA como texto,
 * NÃO é FK para a tabela cia. Por isso precisamos dessa conversão.
 */
export async function getVendasCiaFilter(ciaIds: number[]): Promise<string[]> {
    if (ciaIds.length === 0) return [];

    const cias = await s4DotzClient.cia.findMany({
        where: {
            id: { in: ciaIds },
            deletadoEm: null,
        },
        select: {
            ciaIdSAP: true,
        },
    });

    return cias
        .map((c: { ciaIdSAP: string | null }) => c.ciaIdSAP)
        .filter((sap: string | null): sap is string => Boolean(sap?.trim()))
        .map((sap: string) => sap.trim());
}
