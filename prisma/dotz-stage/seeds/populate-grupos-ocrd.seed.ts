import { PrismaClient as PrismaClientDotzStage } from "@prisma/client-dotz-stage";

interface GrupoOCRD {
    U_CODDOTZ: number;
    qtde: number;
}

export async function seedGruposOCRD(prisma: PrismaClientDotzStage) {
    console.debug("\n=== Iniciando seed de grupos OCRD (CODIGO_PAI) ===");

    // 1. Buscar U_CODDOTZ elegíveis (sem CODIGO_PAI preenchido)
    const gruposElegiveis = await prisma.$queryRaw<GrupoOCRD[]>`
        SELECT 
            U_CODDOTZ,
            COUNT(CardCode) as qtde
        FROM OCRD
        WHERE U_CODDOTZ IS NOT NULL 
          AND CODIGO_PAI IS NULL
        GROUP BY U_CODDOTZ
        HAVING COUNT(CardCode) > 1
        ORDER BY COUNT(CardCode) DESC
    `;

    if (gruposElegiveis.length === 0) {
        console.debug("✓ Nenhum grupo para criar. Todos os U_CODDOTZ já possuem CODIGO_PAI atribuído.");
        return;
    }

    console.debug(`Encontrados ${gruposElegiveis.length} U_CODDOTZ elegíveis para receber CODIGO_PAI\n`);

    let gruposCriados = 0;
    let totalCardCodesAtualizados = 0;

    // 2. Para cada U_CODDOTZ, buscar primeira ocorrência e usá-la como pai (CODIGO_PAI do pai fica null; filhos recebem o CardCode do pai)
    for (const grupo of gruposElegiveis) {
        try {
            // Buscar CardCode da primeira ocorrência do grupo (ordenado por CardCode)
            const primeiroRegistro = await prisma.oCRD.findFirst({
                where: {
                    U_CODDOTZ: grupo.U_CODDOTZ,
                    CODIGO_PAI: null,
                },
                select: {
                    CardCode: true,
                },
                orderBy: {
                    CardCode: 'asc',
                },
            });

            if (!primeiroRegistro?.CardCode) {
                console.debug(`✗ Erro: Não foi possível encontrar CardCode para U_CODDOTZ ${grupo.U_CODDOTZ}`);
                continue;
            }

            const codigoPai = primeiroRegistro.CardCode;

            // Atualizar todos os CardCodes do grupo (exceto o pai) para apontarem para o pai
            const resultado = await prisma.oCRD.updateMany({
                where: {
                    U_CODDOTZ: grupo.U_CODDOTZ,
                    CODIGO_PAI: null,
                    CardCode: { not: codigoPai },
                },
                data: {
                    CODIGO_PAI: codigoPai,
                },
            });

            if (resultado.count > 0) {
                gruposCriados++;
                totalCardCodesAtualizados += resultado.count;
                console.debug(`✓ CODIGO_PAI [${codigoPai}] atribuído para U_CODDOTZ ${grupo.U_CODDOTZ} (${resultado.count} CardCodes)`);
            }
        } catch (error) {
            console.debug(`✗ Erro ao criar grupo para U_CODDOTZ ${grupo.U_CODDOTZ}:`, error);
        }
    }

    // 3. Logar estatísticas finais
    console.debug(`\n=== Seed de grupos OCRD (CODIGO_PAI) concluída ===`);
    console.debug(`✓ ${gruposCriados} grupos criados com sucesso`);
    console.debug(`✓ ${totalCardCodesAtualizados.toLocaleString('pt-BR')} CardCodes atualizados com CODIGO_PAI\n`);
}

