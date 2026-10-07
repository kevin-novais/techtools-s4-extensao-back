import getDotzStageClient from "@/database/clients/dotzStageClient";
import { parseDateForFilter, parseDateForFilterEnd } from "@/util/date";
import { parseAgGridFilterModel, parseAgGridSortModel } from "@/util/filter";
import { Prisma } from "@prisma/client-dotz-stage";

export interface PosRawQueryParams {
    dataEmissaoDe?: string;
    dataEmissaoAte?: string;
    dataVencimentoDe?: string;
    dataVencimentoAte?: string;
    segmento?: string;
    filterModel?: string;
    sortModel?: string;
}

interface RawFilterCondition {
    filterType?: "text" | "number" | "date";
    type?: string;
    filter?: string | number;
    dateFrom?: string;
    dateTo?: string | null;
}

interface RawCompositeFilter extends RawFilterCondition {
    operator?: "AND" | "OR";
    conditions?: RawFilterCondition[];
}

interface PosRawRow {
    LineNum: number;
    ItemCode: string | null;
    Dscription: string | null;
    Quantity: Prisma.Decimal | null;
    Price: Prisma.Decimal | null;
    LineTotal: Prisma.Decimal | null;
    U_PEDANALYSER: number | null;
    U_POS_ID: number | null;
    CardCode: string | null;
    CardName: string | null;
    DocEntry: number;
    DocDate: Date | null;
    DocDueDate: Date | null;
    CODIGO_PAI: string | null;
    OcrdCardName: string | null;
    U_Seidor_PC_Calcula: number | null;
    U_DOTZNRPED: number | null;
}

export interface PosHeaderRow {
    codigoPai: string | null;
    codigoParceiroSap: string;
    codigoParceiroAnalyzer: number | null;
    totalPedidos: number;
}

interface PosSummaryRaw {
    totalItems: bigint | number;
    valorTotal: Prisma.Decimal | null;
}

const filterColumns: Record<string, Prisma.Sql> = {
    posId: Prisma.raw("p.[U_POS_ID]"),
    codigoParceiro: Prisma.raw("o.[CardCode]"),
    parceiro: Prisma.raw("o.[CardName]"),
    grupoCodigo: Prisma.raw("c.[CODIGO_PAI]"),
    docPedido: Prisma.raw("o.[DocEntry]"),
    pedAnalyzer: Prisma.raw("p.[U_PEDANALYSER]"),
    dataPedido: Prisma.raw("o.[DocDate]"),
    dataVencimento: Prisma.raw("o.[DocDueDate]"),
    item: Prisma.raw("p.[ItemCode]"),
    descricao: Prisma.raw("p.[Dscription]"),
    quantidade: Prisma.raw("p.[Quantity]"),
    total: Prisma.raw("p.[LineTotal]"),
    lineNum: Prisma.raw("p.[LineNum]"),
    tipoItem: Prisma.raw("i.[U_Seidor_PC_Calcula]"),
    preco: Prisma.raw("p.[Price]"),
};

const defaultOrderBy = Prisma.raw("o.[CardCode] ASC, p.[ItemCode] ASC, p.[DocEntry] ASC, p.[LineNum] ASC");

export class PosRawQueryRepository {
    async summarize(params: PosRawQueryParams): Promise<{ totalItems: number; valorTotal: number }> {
        const client = getDotzStageClient();
        const where = this.buildWhere(params);
        const summaries = await client.$queryRaw(Prisma.sql`
            SELECT
                COUNT_BIG(*) AS [totalItems],
                SUM(p.[LineTotal]) AS [valorTotal]
            ${this.fromClause()}
            WHERE ${where}
        `) as PosSummaryRaw[];
        const [summary] = summaries;

        return {
            totalItems: Number(summary?.totalItems ?? 0),
            valorTotal: Number(summary?.valorTotal ?? 0),
        };
    }

    async count(params: PosRawQueryParams): Promise<number> {
        const { totalItems } = await this.summarize(params);
        return totalItems;
    }

    async findManyDetails(params: PosRawQueryParams, skip?: number, take?: number): Promise<any[]> {
        const client = getDotzStageClient();
        const where = this.buildWhere(params);
        const orderBy = this.buildOrderBy(params.sortModel);
        const pagination = take !== undefined
            ? Prisma.sql`OFFSET ${skip ?? 0} ROWS FETCH NEXT ${take} ROWS ONLY`
            : Prisma.empty;
        const rows = await client.$queryRaw(Prisma.sql`
            SELECT
                p.[LineNum],
                p.[ItemCode],
                p.[Dscription],
                p.[Quantity],
                p.[Price],
                p.[LineTotal],
                p.[U_PEDANALYSER],
                p.[U_POS_ID],
                o.[CardCode],
                o.[CardName],
                o.[DocEntry],
                o.[DocDate],
                o.[DocDueDate],
                c.[CODIGO_PAI],
                c.[CardName] AS [OcrdCardName],
                i.[U_Seidor_PC_Calcula],
                o.[U_DOTZNRPED]
            ${this.fromClause()}
            WHERE ${where}
            ORDER BY ${orderBy}
            ${pagination}
        `) as PosRawRow[];

        return rows.map((row) => ({
            LineNum: row.LineNum,
            ItemCode: row.ItemCode,
            Dscription: row.Dscription,
            Quantity: row.Quantity,
            Price: row.Price,
            LineTotal: row.LineTotal,
            U_PEDANALYSER: row.U_PEDANALYSER,
            U_POS_ID: row.U_POS_ID,
            
            OPOR: {
                CardCode: row.CardCode,
                CardName: row.CardName,
                DocEntry: row.DocEntry,
                DocDate: row.DocDate,
                DocDueDate: row.DocDueDate,
                U_DOTZNRPED: row.U_DOTZNRPED,
                OCRD: row.CardCode
                    ? { CODIGO_PAI: row.CODIGO_PAI, CardName: row.OcrdCardName }
                    : null,
            },
            OITM: row.ItemCode
                ? { U_Seidor_PC_Calcula: row.U_Seidor_PC_Calcula }
                : null,
        }));
    }

    async findManyHeaders(params: PosRawQueryParams): Promise<PosHeaderRow[]> {
        const client = getDotzStageClient();
        const where = this.buildWhere(params);
        const rows = await client.$queryRaw(Prisma.sql`
            SELECT
                c.[CODIGO_PAI] as [codigoPai],
                c.[CardCode] as [codigoParceiroSap],
                c.[U_CODDOTZ] AS [codigoParceiroAnalyzer],
                COUNT(*) AS [totalPedidos]
            ${this.fromClause()}
            WHERE ${where}
            GROUP BY c.[CODIGO_PAI], c.[CardCode], c.[U_CODDOTZ]
        `) as PosHeaderRow[];

        return rows;
    }

    private fromClause(): Prisma.Sql {
        return Prisma.sql`
            FROM [dbo].[POR1] p
            INNER JOIN [dbo].[OPOR] o ON o.[DocEntry] = p.[DocEntry]
            LEFT JOIN [dbo].[OCRD] c ON c.[CardCode] = o.[CardCode]
            LEFT JOIN [dbo].[OITM] i ON i.[ItemCode] = p.[ItemCode]
        `;
    }

    private buildWhere(params: PosRawQueryParams): Prisma.Sql {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`p.[LineStatus] <> 'C'`,
            Prisma.sql`p.[U_POS_ID] IS NOT NULL`,
            Prisma.sql`p.[U_DocEntryNF] IS NULL`,
            Prisma.sql`o.[U_DOTZ_TIPO] = 'TEF'`,
            Prisma.sql`o.[DocStatus] = 'O'`,
            Prisma.sql`
                NOT EXISTS (
                    SELECT 1
                    FROM [s4_extensao_dotz].[dbo].[documento_fiscal_detail] dfd
                    WHERE dfd.[codigo_pedido_analyzer] = CONVERT(NVARCHAR(50), o.[DocEntry])
                )
            `,
        ];

        const emissao = this.buildDateRange(
            Prisma.raw("o.[DocDate]"),
            params.dataEmissaoDe,
            params.dataEmissaoAte,
        );
        if (emissao) conditions.push(emissao);

        const vencimento = this.buildDateRange(
            Prisma.raw("o.[DocDueDate]"),
            params.dataVencimentoDe,
            params.dataVencimentoAte,
        );
        if (vencimento) conditions.push(vencimento);

        if (params.segmento) {
            conditions.push(Prisma.sql`(
                c.[CODIGO_PAI] = ${params.segmento}
                OR (c.[CODIGO_PAI] IS NULL AND o.[CardCode] = ${params.segmento})
            )`);
        }

        const filterModel = parseAgGridFilterModel(params.filterModel);
        if (filterModel) {
            for (const [field, rawFilter] of Object.entries(filterModel)) {
                const filter = rawFilter as RawCompositeFilter;
                const condition = field === "grupoNome"
                    ? this.buildGrupoNomeFilter(filter)
                    : this.buildColumnFilter(filterColumns[field], filter);
                if (condition) conditions.push(condition);
            }
        }

        return Prisma.join(conditions, " AND ");
    }

    private buildDateRange(column: Prisma.Sql, from?: string, to?: string): Prisma.Sql | null {
        if (from && to) {
            return Prisma.sql`${column} >= ${parseDateForFilter(from)} AND ${column} <= ${parseDateForFilterEnd(to)}`;
        }
        if (from) return Prisma.sql`${column} >= ${parseDateForFilter(from)}`;
        if (to) return Prisma.sql`${column} <= ${parseDateForFilterEnd(to)}`;
        return null;
    }

    private buildGrupoNomeFilter(filter: RawCompositeFilter): Prisma.Sql | null {
        const value = filter.filter;
        if (filter.filterType !== "text" || typeof value !== "string" || !value.trim()) return null;

        // A regra anterior tratava grupoNome sempre como busca parcial,
        // independentemente do operador enviado pelo AG Grid.
        const pattern = `%${value.trim()}%`;

        return Prisma.sql`(
            c.[CardName] LIKE ${pattern}
            OR c.[CODIGO_PAI] LIKE ${pattern}
            OR o.[CardName] LIKE ${pattern}
            OR o.[CardCode] LIKE ${pattern}
        )`;
    }

    private buildColumnFilter(column: Prisma.Sql | undefined, filter: RawCompositeFilter): Prisma.Sql | null {
        if (!column) return null;

        if ((filter.operator === "AND" || filter.operator === "OR") && Array.isArray(filter.conditions)) {
            const parts = filter.conditions
                .map((condition) => this.buildSimpleFilter(column, condition))
                .filter((condition): condition is Prisma.Sql => condition !== null);
            if (parts.length === 0) return null;
            const separator = filter.operator === "OR" ? " OR " : " AND ";
            return Prisma.sql`(${Prisma.join(parts, separator)})`;
        }

        return this.buildSimpleFilter(column, filter);
    }

    private buildSimpleFilter(column: Prisma.Sql, filter: RawFilterCondition): Prisma.Sql | null {
        if (filter.filterType === "text") {
            if (filter.filter === undefined || filter.filter === null || String(filter.filter).trim() === "") return null;
            const pattern = this.textPattern(filter.type, String(filter.filter).trim());
            return pattern
                ? Prisma.sql`CONVERT(NVARCHAR(MAX), ${column}) LIKE ${pattern}`
                : null;
        }

        if (filter.filterType === "number") {
            const value = Number(filter.filter);
            if (Number.isNaN(value)) return null;
            if (filter.type === "equals") return Prisma.sql`${column} = ${value}`;
            if (filter.type === "greaterThan") return Prisma.sql`${column} > ${value}`;
            if (filter.type === "lessThan") return Prisma.sql`${column} < ${value}`;
            return null;
        }

        if (filter.filterType === "date" && filter.dateFrom) {
            const from = filter.dateFrom.slice(0, 10);
            if (filter.type === "equals") return this.buildDateRange(column, from, from);
            if (filter.type === "greaterThan") return Prisma.sql`${column} > ${parseDateForFilterEnd(from)}`;
            if (filter.type === "lessThan") return Prisma.sql`${column} < ${parseDateForFilter(from)}`;
            if (filter.type === "inRange") {
                return this.buildDateRange(column, from, filter.dateTo?.slice(0, 10) ?? from);
            }
        }

        return null;
    }

    private textPattern(type: string | undefined, value: string): string | null {
        if (type === "equals") return value;
        if (type === "contains") return `%${value}%`;
        if (type === "startsWith") return `${value}%`;
        if (type === "endsWith") return `%${value}`;
        return null;
    }

    private buildOrderBy(sortModel?: string): Prisma.Sql {
        const parsed = parseAgGridSortModel(sortModel);
        if (!parsed) return defaultOrderBy;

        const clauses = parsed.flatMap(({ colId, sort }) => {
            const column = filterColumns[colId];
            return column ? [Prisma.sql`${column} ${Prisma.raw(sort.toUpperCase())}`] : [];
        });

        return clauses.length > 0
            ? Prisma.join([...clauses, Prisma.raw("p.[DocEntry] ASC"), Prisma.raw("p.[LineNum] ASC")], ", ")
            : defaultOrderBy;
    }
}
