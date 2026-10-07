import dotzStageClient from "@/database/clients/dotzStageClient";

interface OcrFornecedorComboboxCursorListParams {
    cursor?: string;
    limit?: number;
    search?: string;
}

interface OcrFornecedorComboboxCursorListResponse {
    fornecedores: Array<{
        cardCode: string;
        cardName: string | null;
        cnpj: string | null;
        uCodDotz: number | null;
        label: string;
    }>;
    pagination: {
        nextCursor: string | null;
        hasNextPage: boolean;
    };
}

interface OcrFornecedorComboboxCursorItem {
    CardCode: string;
    CardName: string | null;
    cnpj: string | null;
    U_CODDOTZ: number | null;
}

export class OcrFornecedorComboboxCursorListService {
    async execute(params: OcrFornecedorComboboxCursorListParams = {}): Promise<OcrFornecedorComboboxCursorListResponse> {
        const { cursor, limit = 20, search } = params;
        const validatedLimit = this.validateLimit(limit);
        const searchTrimmed = search?.trim();
        const cnpjDigits = searchTrimmed?.replaceAll(/\D/g, "") ?? "";

        const where = {
            ativo: true,
            ...(searchTrimmed
                ? {
                    OR: [
                        { CardCode: { contains: searchTrimmed } },
                        { CardName: { contains: searchTrimmed } },
                        ...(cnpjDigits.length >= 8 ? [{ cnpj: { contains: cnpjDigits } }] : []),
                    ],
                }
                : {}),
        };

        const fornecedores = await dotzStageClient().oCRD.findMany({
            where,
            select: {
                CardCode: true,
                CardName: true,
                cnpj: true,
                U_CODDOTZ: true,
            },
            orderBy: { CardCode: "asc" },
            take: validatedLimit + 1,
            skip: cursor ? 1 : 0,
            ...(cursor
                ? {
                    cursor: { CardCode: cursor },
                }
                : {}),
        });

        const hasNextPage = fornecedores.length > validatedLimit;
        const fornecedoresToReturn = hasNextPage ? fornecedores.slice(0, validatedLimit) : fornecedores;
        const nextCursor = hasNextPage ? fornecedoresToReturn[fornecedoresToReturn.length - 1].CardCode : null;

        return {
            fornecedores: fornecedoresToReturn.map((fornecedor: OcrFornecedorComboboxCursorItem) => ({
                cardCode: fornecedor.CardCode,
                cardName: fornecedor.CardName ?? null,
                cnpj: fornecedor.cnpj ?? null,
                uCodDotz: fornecedor.U_CODDOTZ ?? null,
                label: fornecedor.CardName?.trim()
                    ? `${fornecedor.CardCode} - ${fornecedor.CardName}`
                    : fornecedor.CardCode,
            })),
            pagination: {
                nextCursor,
                hasNextPage,
            },
        };
    }

    private validateLimit(limit: number) {
        if (limit < 1) return 1;
        if (limit > 100) return 100;
        return limit;
    }
}
