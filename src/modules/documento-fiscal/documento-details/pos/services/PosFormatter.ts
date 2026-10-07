import { formatDateOnly } from "@/util/date";

export interface PosItem {
    posId: number | null;
    codigoParceiro: string | null;
    parceiro: string | null;
    grupoCodigo: string | null;
    grupoNome: string | null;
    docPedido: number;
    pedAnalyzer: number | null;
    dataPedido: string;
    dataVencimento: string;
    item: string | null;
    descricao: string | null;
    quantidade: number;
    total: number;
    lineNum: number;
    tipoItem: number;
    preco: number;
}

export class PosFormatter {
    static async buildParentNameMap(linhas: any[], client: any): Promise<Record<string, string>> {
        const parentCodes = new Set<string>();

        linhas.forEach((linha) => {
            const codigoPai = linha.OPOR?.OCRD?.CODIGO_PAI;
            if (codigoPai) {
                parentCodes.add(codigoPai);
            }
        });

        if (parentCodes.size === 0) {
            return {};
        }

        const pais = await client.OCRD.findMany({
            where: { CardCode: { in: Array.from(parentCodes) } },
            select: { CardCode: true, CardName: true },
        });

        return pais.reduce((acc: Record<string, string>, pai: { CardCode: string; CardName: string | null }) => {
            if (pai.CardCode) {
                acc[pai.CardCode] = pai.CardName ?? "";
            }
            return acc;
        }, {});
    }

    static formatResponse(linhas: any[], parentMap: Record<string, string>): PosItem[] {
        return linhas.map((linha) => {
            // Coalesce: U_Seidor_PC_Calcula ?? 2
            const tipoItem = linha.OITM?.U_Seidor_PC_Calcula ?? 2;

            const grupoCodigo = linha.OPOR.OCRD?.CODIGO_PAI ?? linha.OPOR.CardCode ?? null;
            const grupoNomePai = grupoCodigo ? parentMap[grupoCodigo] : null;

            return {
                posId: linha.U_POS_ID,
                codigoParceiro: linha.OPOR.CardCode,
                parceiro: linha.OPOR.CardName,
                grupoCodigo,
                grupoNome: grupoNomePai ?? linha.OPOR.OCRD?.CardName ?? linha.OPOR.CardName ?? null,
                docPedido: linha.OPOR.DocEntry,
                pedAnalyzer: linha.U_PEDANALYSER,
                dataPedido: formatDateOnly(linha.OPOR.DocDate),
                dataVencimento: formatDateOnly(linha.OPOR.DocDueDate),
                item: linha.ItemCode,
                descricao: linha.Dscription,
                quantidade: linha.Quantity ? Number(linha.Quantity) : 0,
                total: linha.LineTotal ? Number(linha.LineTotal) : 0,
                lineNum: linha.LineNum,
                tipoItem,
                preco: linha.Price ? Number(linha.Price) : 0,
            };
        });
    }
}
