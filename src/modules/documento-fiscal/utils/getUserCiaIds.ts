import s4DotzClient from "@/database/clients/s4DotzClient";

/**
 * Retorna os IDs das CIAs que o usuário tem acesso através dos grupos de usuário
 * @param usuarioId - ID do usuário
 * @returns Array de IDs das CIAs (vazio se usuário não tem acesso a nenhuma CIA)
 */
export async function getUserCiaIds(usuarioId: number): Promise<number[]> {
    const gruposUsuario = await s4DotzClient.usuarioGrupoUsuario.findMany({
        where: {
            usuarioId,
            grupoUsuario: {
                deletadoEm: null,
            },
        },
        select: {
            grupoUsuario: {
                select: {
                    ciaId: true,
                },
            },
        },
    });

    // Extrair CiaIds únicos usando Set
    const ciaIdsSet = new Set<number>();
    
    for (const rel of gruposUsuario) {
        ciaIdsSet.add(rel.grupoUsuario.ciaId);
    }

    return Array.from(ciaIdsSet);
}

