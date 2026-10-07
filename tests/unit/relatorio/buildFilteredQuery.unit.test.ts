import { describe, expect, it } from 'vitest';
import { buildFilteredQuery, buildCountQuery } from '../../../src/modules/relatorio/utils/buildFilteredQuery';
import AppError from '../../../src/util/AppError';

const BASE_QUERY = 'SELECT id, nome, status FROM usuarios';

describe('buildFilteredQuery', () => {
    it('deve gerar SQL básico sem filtros', () => {
        const { sql, params } = buildFilteredQuery({ baseQuery: BASE_QUERY });
        expect(sql).toContain('SELECT * FROM');
        expect(sql).toContain('_rel');
        expect(sql).toContain('OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY');
        expect(params).toHaveLength(0);
    });

    it('deve aplicar paginação corretamente', () => {
        const { sql } = buildFilteredQuery({ baseQuery: BASE_QUERY, page: 2, pageSize: 10 });
        expect(sql).toContain('OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY');
    });

    it('deve limitar pageSize ao máximo de 200', () => {
        const { sql } = buildFilteredQuery({ baseQuery: BASE_QUERY, pageSize: 999 });
        expect(sql).toContain('FETCH NEXT 200 ROWS ONLY');
    });

    it('deve gerar WHERE com filtros', () => {
        const { sql, params } = buildFilteredQuery({
            baseQuery: BASE_QUERY,
            filters: [{ column: 'status', operator: '=', value: 'ATIVO' }],
        });
        expect(sql).toContain('WHERE _rel.[status] = @p1');
        expect(params).toEqual(['ATIVO']);
    });

    it('deve gerar múltiplos filtros com AND', () => {
        const { sql, params } = buildFilteredQuery({
            baseQuery: BASE_QUERY,
            filters: [
                { column: 'status', operator: '=', value: 'ATIVO' },
                { column: 'nome', operator: 'LIKE', value: '%João%' },
            ],
        });
        expect(sql).toContain('AND');
        expect(params).toHaveLength(2);
    });

    it('deve gerar ORDER BY quando fornecido', () => {
        const { sql } = buildFilteredQuery({
            baseQuery: BASE_QUERY,
            orderBy: { column: 'nome', direction: 'ASC' },
        });
        expect(sql).toContain('ORDER BY _rel.[nome] ASC');
    });

    it('deve paginar em exportMode sem aplicar o teto de 200 do pageSize', () => {
        const { sql } = buildFilteredQuery({ baseQuery: BASE_QUERY, exportMode: true, page: 3, pageSize: 20_000 });
        expect(sql).toContain('OFFSET 40000 ROWS FETCH NEXT 20000 ROWS ONLY');
    });

    it('deve reaproveitar ORDER BY do nível raiz da query base', () => {
        const baseQueryWithOrderBy = `
            SELECT id, nome
            FROM usuarios
            ORDER BY nome DESC
        `;

        const { sql } = buildFilteredQuery({ baseQuery: baseQueryWithOrderBy });
        expect(sql).not.toContain('FROM usuarios\n            ORDER BY');
        expect(sql).toContain('FROM usuarios');
        expect(sql).toContain('ORDER BY _rel.[nome] DESC');
    });

    it('deve reaproveitar ORDER BY da query base usando alias do SELECT', () => {
        const baseQueryWithAliasOrderBy = `
            SELECT posting_date AS "Data", supplier AS "Fornecedor"
            FROM s4_extensao_dotz.dbo.registros_contabeis
            WHERE supplier <> 0
            ORDER BY posting_date DESC
        `;

        const { sql } = buildFilteredQuery({ baseQuery: baseQueryWithAliasOrderBy });
        expect(sql).toContain('ORDER BY _rel.[data] DESC');
    });

    it('deve manter ORDER BY dentro de subquery', () => {
        const baseQueryWithInnerOrderBy = `
            SELECT id
            FROM (
                SELECT TOP 10 id
                FROM usuarios
                ORDER BY criado_em DESC
            ) t
        `;

        const { sql } = buildFilteredQuery({ baseQuery: baseQueryWithInnerOrderBy });
        expect(sql).toContain('ORDER BY criado_em DESC');
    });

    it('deve rejeitar nome de coluna com caracteres especiais', () => {
        expect(() =>
            buildFilteredQuery({
                baseQuery: BASE_QUERY,
                filters: [{ column: 'coluna; DROP TABLE', operator: '=', value: '1' }],
            })
        ).toThrow(AppError);
    });

    it('deve rejeitar operador não permitido', () => {
        expect(() =>
            buildFilteredQuery({
                baseQuery: BASE_QUERY,
                filters: [{ column: 'status', operator: 'IS NULL' as never, value: '' }],
            })
        ).toThrow(AppError);
    });

    it('deve rejeitar direção de ordenação inválida', () => {
        expect(() =>
            buildFilteredQuery({
                baseQuery: BASE_QUERY,
                orderBy: { column: 'nome', direction: 'INVALID' as never },
            })
        ).toThrow(AppError);
    });
});

describe('buildCountQuery', () => {
    it('deve gerar query de contagem sem filtros', () => {
        const { sql, params } = buildCountQuery(BASE_QUERY);
        expect(sql).toContain('SELECT COUNT(*) AS total');
        expect(sql).toContain('_count');
        expect(params).toHaveLength(0);
    });

    it('deve gerar query de contagem com filtros', () => {
        const { sql, params } = buildCountQuery(BASE_QUERY, [
            { column: 'status', operator: '=', value: 'ATIVO' },
        ]);
        expect(sql).toContain('WHERE _count.[status] = @p1');
        expect(params).toEqual(['ATIVO']);
    });

    it('deve remover ORDER BY no nível raiz da query de contagem', () => {
        const baseQueryWithOrderBy = 'SELECT id, nome FROM usuarios ORDER BY nome';
        const { sql } = buildCountQuery(baseQueryWithOrderBy);
        expect(sql).not.toContain('ORDER BY nome');
        expect(sql).toContain('SELECT id, nome FROM usuarios');
    });
});
