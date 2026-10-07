import ExcelJS from 'exceljs';
import type { Response } from 'express';
import s4DotzClient from '@/database/clients/s4DotzClient';
import DatabaseManager from '@/database/DatabaseManager';
import AppError from '@/util/AppError';
import log from '@/util/logger';
import { buildFilteredQuery, QueryFilter, QueryOrder } from '@/modules/relatorio/utils/buildFilteredQuery';
import { formatMillisecondsToHHMMSS } from '@/util/date';
import { resolveReportQuery } from '@/modules/relatorio/utils/resolveReportQuery';
import { mapStoredVariavelToInput, ReportVariableValues } from '@/modules/relatorio/utils/relatorioVariableTypes';

const EXPORT_TIMEOUT_MS = 300_000;
// Linhas buscadas por vez do banco e escritas no stream, mantendo o uso de
// memória limitado independente do tamanho total do relatório.
const EXPORT_CHUNK_SIZE = 20_000;

interface RelatorioExportInput {
    id: number;
    userId: number;
    filters?: QueryFilter[];
    orderBy?: QueryOrder;
    variables?: ReportVariableValues;
    res: Response;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new AppError(`Tempo limite da exportação excedido (${formatMillisecondsToHHMMSS(ms)})`, 408)), ms)
        ),
    ]);
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        if (value !== null && typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
            out[key] = (value as { toNumber: () => number }).toNumber();
        } else if (typeof value === 'bigint') {
            out[key] = Number(value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

export class RelatorioExportService {
    /**
     * Gera o XLSX em streaming, escrevendo direto na resposta HTTP em blocos de
     * EXPORT_CHUNK_SIZE linhas por vez. Evita acumular o resultado inteiro (e
     * suas cópias intermediárias) em memória, o que derrubava o pod (OOMKill)
     * em relatórios grandes desde que o limite de exportação foi removido.
     */
    async execute({ id, userId, filters = [], orderBy, variables = {}, res }: RelatorioExportInput): Promise<void> {
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
        const filename = this.buildFilename(relatorio.nome);

        // A partir daqui já vamos escrever na resposta: qualquer erro depois
        // deste ponto não pode mais virar uma resposta JSON normal.
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: false, useSharedStrings: false });
        const worksheet = workbook.addWorksheet('Relatório');
        const startTime = Date.now();

        try {
            const totalRows = await this.streamRows({
                worksheet,
                resolvedQuery,
                filters,
                orderBy,
                variableParams,
                startTime,
            });

            await workbook.commit();

            await s4DotzClient.relatorioExecucaoLog.create({
                data: { relatorioId: id, executadoPorId: userId, duracaoMs: Date.now() - startTime, totalLinhas: totalRows, status: 'SUCESSO' },
            });
        } catch (err) {
            await this.handleExportError({ err, id, userId, startTime, res });
        }
    }

    private buildFilename(relatorioNome: string): string {
        const dataSuffix = new Date().toISOString().slice(0, 10);
        const safeName = relatorioNome.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `relatorio-${safeName}-${dataSuffix}.xlsx`;
    }

    /**
     * Busca as linhas em páginas de EXPORT_CHUNK_SIZE e escreve cada uma no
     * worksheet em streaming, descartando o chunk da memória assim que
     * commitado. Retorna o total de linhas exportadas.
     */
    private async streamRows(params: {
        worksheet: ExcelJS.Worksheet;
        resolvedQuery: string;
        filters: QueryFilter[];
        orderBy: QueryOrder | undefined;
        variableParams: (string | number | Date)[];
        startTime: number;
    }): Promise<number> {
        const { worksheet, resolvedQuery, filters, orderBy, variableParams, startTime } = params;
        const relatorioReadonlyClient = DatabaseManager.getRelatorioReadonlyClient();
        const paramOffset = variableParams.length;

        let totalRows = 0;
        let headerWritten = false;
        let page = 1;

        for (;;) {
            const remaining = EXPORT_TIMEOUT_MS - (Date.now() - startTime);
            if (remaining <= 0) {
                throw new AppError(`Tempo limite da exportação excedido (${formatMillisecondsToHHMMSS(EXPORT_TIMEOUT_MS)})`, 408);
            }

            const { sql, params: filterParams } = buildFilteredQuery({
                baseQuery: resolvedQuery,
                filters,
                orderBy,
                exportMode: true,
                page,
                pageSize: EXPORT_CHUNK_SIZE,
                paramOffset,
            });
            const queryParams = [...variableParams, ...filterParams];

            const rows: Record<string, unknown>[] = await withTimeout(
                relatorioReadonlyClient.$queryRawUnsafe(sql, ...queryParams),
                remaining
            );

            if (rows.length === 0) break;

            if (!headerWritten) {
                worksheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
                headerWritten = true;
            }

            for (const row of rows) {
                worksheet.addRow(serializeRow(row)).commit();
            }

            totalRows += rows.length;

            if (rows.length < EXPORT_CHUNK_SIZE) break;
            page += 1;
        }

        return totalRows;
    }

    /**
     * Registra o log de erro e decide como responder: se a resposta ainda não
     * começou a ser escrita, propaga um erro normal (o handler global monta o
     * JSON de erro). Se já começamos a fazer streaming do XLSX, não há mais
     * como responder um JSON — só encerramos a conexão.
     */
    private async handleExportError(params: { err: unknown; id: number; userId: number; startTime: number; res: Response }): Promise<void> {
        const { err, id, userId, startTime, res } = params;
        const mensagemErro = err instanceof Error ? err.message : String(err);

        await s4DotzClient.relatorioExecucaoLog
            .create({
                data: { relatorioId: id, executadoPorId: userId, duracaoMs: Date.now() - startTime, totalLinhas: 0, status: 'ERRO', mensagemErro },
            })
            .catch((logError: unknown) => log.error('[RelatorioExportService] Erro ao registrar log de execução: %o', logError));

        if (!res.headersSent) {
            if (err instanceof AppError) throw err;
            throw new AppError(`Erro ao exportar relatório: ${mensagemErro}`, 500);
        }

        log.error('[RelatorioExportService] Falha durante exportação em streaming (conexão será encerrada): %o', err);
        if (!res.writableEnded) {
            res.destroy(err instanceof Error ? err : new Error(mensagemErro));
        }
    }
}
