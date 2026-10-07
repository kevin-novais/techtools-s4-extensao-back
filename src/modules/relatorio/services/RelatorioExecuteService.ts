import s4DotzClient from '@/database/clients/s4DotzClient';
import DatabaseManager from '@/database/DatabaseManager';
import AppError from '@/util/AppError';
import { buildCountQuery, buildFilteredQuery, QueryFilter, QueryOrder } from '@/modules/relatorio/utils/buildFilteredQuery';
import { resolveReportQuery } from '@/modules/relatorio/utils/resolveReportQuery';
import { mapStoredVariavelToInput, ReportVariableValues } from '@/modules/relatorio/utils/relatorioVariableTypes';

const QUERY_TIMEOUT_MS = 300_000;

interface RelatorioExecuteInput {
    id: number;
    userId: number;
    page?: number;
    pageSize?: number;
    filters?: QueryFilter[];
    orderBy?: QueryOrder;
    variables?: ReportVariableValues;
}

function serializeBigInts(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => {
        const serializedRow: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            serializedRow[key] = typeof value === 'bigint' ? value.toString() : value;
        }
        return serializedRow;
    });
}

function extractSqlMessage(raw: string | undefined): string {
    if (!raw) return 'erro desconhecido';
    const match = /Message:\s*`([^`]+)`/.exec(raw);
    return match ? match[1] : 'erro ao processar a query';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new AppError('Tempo limite da query excedido (30s)', 408)), ms)
        ),
    ]);
}

export class RelatorioExecuteService {
    async execute({
        id,
        userId,
        page = 1,
        pageSize = 50,
        filters = [],
        orderBy,
        variables = {},
    }: RelatorioExecuteInput) {
        const relatorio = await s4DotzClient.relatorio.findUnique({
            where: { id },
            include: { variaveis: { orderBy: { ordem: 'asc' } } },
        });

        if (!relatorio) throw new AppError('Relatório não encontrado', 404);

        const variaveis = relatorio.variaveis.map(mapStoredVariavelToInput);
        const { resolvedQuery, variableParams } = resolveReportQuery(
            relatorio.query,
            variaveis,
            variables,
        );
        const paramOffset = variableParams.length;

        const relatorioReadonlyClient = DatabaseManager.getRelatorioReadonlyClient();

        const { sql: countSql, params: countFilterParams } = buildCountQuery(
            resolvedQuery,
            filters,
            paramOffset,
        );
        const { sql, params: dataFilterParams } = buildFilteredQuery({
            baseQuery: resolvedQuery,
            filters,
            orderBy,
            page,
            pageSize,
            paramOffset,
        });
        const countParams = [...variableParams, ...countFilterParams];
        const dataParams = [...variableParams, ...dataFilterParams];

        const startTime = Date.now();
        let status = 'SUCESSO';
        let mensagemErro: string | undefined;
        let totalLinhas = 0;
        let rows: Record<string, unknown>[] = [];

        try {
            const [countResult, dataResult] = await withTimeout(
                Promise.all([
                    relatorioReadonlyClient.$queryRawUnsafe(countSql, ...countParams),
                    relatorioReadonlyClient.$queryRawUnsafe(sql, ...dataParams),
                ]),
                QUERY_TIMEOUT_MS
            );

            const countRow = (countResult as { total: number }[])[0];
            totalLinhas = Number(countRow?.total ?? 0);
            rows = serializeBigInts(dataResult as Record<string, unknown>[]);
        } catch (err) {
            status = 'ERRO';
            mensagemErro = err instanceof Error ? err.message : String(err);

            await s4DotzClient.relatorioExecucaoLog.create({
                data: {
                    relatorioId: id,
                    executadoPorId: userId,
                    duracaoMs: Date.now() - startTime,
                    totalLinhas: 0,
                    status: 'ERRO',
                    mensagemErro,
                },
            });

            if (err instanceof AppError) throw err;
            throw new AppError(`Erro ao executar a query: ${extractSqlMessage(mensagemErro)}`, 400);
        }

        await s4DotzClient.relatorioExecucaoLog.create({
            data: {
                relatorioId: id,
                executadoPorId: userId,
                duracaoMs: Date.now() - startTime,
                totalLinhas,
                status,
            },
        });

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return {
            data: rows,
            total: totalLinhas,
            page,
            pageSize,
            columns,
            executedQuery: sql,
            executedParams: dataParams,
        };
    }
}
