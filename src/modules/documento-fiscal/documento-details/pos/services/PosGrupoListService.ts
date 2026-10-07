import getDotzStageClient from "@/database/clients/dotzStageClient";

interface PosGrupoListParams {
    cursor?: string;
    limit?: number;
    search?: string;
}

interface PosGrupoListResponse {
    grupos: Array<{
        codigo: string;
        nome: string;
        uCodDotz: number | null;
        quantidadeEstabelecimentos: number;
    }>;
    pagination: {
        nextCursor: string | null;
        hasNextPage: boolean;
    };
}

export class PosGrupoListService {
    async execute(params: PosGrupoListParams = {}): Promise<PosGrupoListResponse> {
        const { cursor, limit = 20, search } = params;

        const validatedLimit = this.validateLimit(limit);
        const searchTrimmed = search?.trim();

        // Listamos somente registros ativos cujo CODIGO_PAI é null (pais)
        const where: any = {
            CODIGO_PAI: null,
            ativo: true,
        };

        if (searchTrimmed) {
            const codigoAnalyzer = Number(searchTrimmed);
            const isCodigoAnalyzer = /^\d+$/.test(searchTrimmed) && !Number.isNaN(codigoAnalyzer);

            where.OR = [
                { CardCode: { contains: searchTrimmed } },
                { CardName: { contains: searchTrimmed } },
                ...(isCodigoAnalyzer ? [{ U_CODDOTZ: codigoAnalyzer }] : []),
            ];
        }

        const pais = await getDotzStageClient().OCRD.findMany({
            where,
            select: {
                CardCode: true,
                CardName: true,
                U_CODDOTZ: true,
            },
            orderBy: {
                CardCode: 'asc',
            },
            take: validatedLimit + 1,
            skip: cursor ? 1 : 0,
            ...(cursor
                ? {
                    cursor: {
                        CardCode: cursor,
                    },
                }
                : {}),
        });

        const hasNextPage = pais.length > validatedLimit;
        const paisToReturn = hasNextPage ? pais.slice(0, validatedLimit) : pais;

        const codigosPais = paisToReturn
            .map((p: { CardCode: string | null }) => p.CardCode)
            .filter((c: string | null): c is string => c != null && c !== '');

        // Contar estabelecimentos de cada pai: inclui o próprio pai (CardCode) e filhos (CODIGO_PAI = pai)
        const contagemMap = new Map<string, number>();
        for (const codigoPai of codigosPais) {
            const count = await getDotzStageClient().OCRD.count({
                where: {
                    OR: [
                        { CODIGO_PAI: codigoPai },
                        { CardCode: codigoPai },
                    ],
                },
            });
            contagemMap.set(codigoPai, count);
        }

        const formattedGrupos = paisToReturn.map((grupo: {
            CardCode: string;
            CardName: string | null;
            U_CODDOTZ: number | null;
        }) => ({
            codigo: grupo.CardCode,
            nome: grupo.CardName || '',
            uCodDotz: grupo.U_CODDOTZ,
            quantidadeEstabelecimentos: contagemMap.get(grupo.CardCode) || 0,
        }));

        const nextCursor = hasNextPage ? paisToReturn[paisToReturn.length - 1].CardCode : null;

        return {
            grupos: formattedGrupos,
            pagination: {
                nextCursor,
                hasNextPage,
            },
        };
    }

    private validateLimit(limit: number): number {
        if (limit < 1) return 1;
        if (limit > 100) return 100;
        return limit;
    }
}
