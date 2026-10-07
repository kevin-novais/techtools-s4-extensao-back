import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RelatorioExecuteService } from '../../../src/modules/relatorio/services/RelatorioExecuteService';

vi.mock('../../../src/database/clients/s4DotzClient', () => ({
    default: {
        relatorio: {
            findUnique: vi.fn(),
        },
        relatorioExecucaoLog: {
            create: vi.fn(),
        },
    },
}));

const mockQueryRawUnsafe = vi.fn();

vi.mock('../../../src/database/DatabaseManager', () => ({
    default: {
        getRelatorioReadonlyClient: vi.fn(() => ({
            $queryRawUnsafe: mockQueryRawUnsafe,
        })),
    },
}));

import s4DotzClient from '../../../src/database/clients/s4DotzClient';

const mockRelatorio = {
    id: 1,
    nome: 'Teste',
    query: 'SELECT id, nome FROM usuarios',
    variaveis: [],
};

describe('RelatorioExecuteService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve lançar 404 quando relatório não existe', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(null);

        const service = new RelatorioExecuteService();
        await expect(
            service.execute({ id: 999, userId: 1 })
        ).rejects.toMatchObject({ message: 'Relatório não encontrado', statusCode: 404 });
    });

    it('deve executar query e retornar dados paginados', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);

        mockQueryRawUnsafe
            .mockResolvedValueOnce([{ total: 2 }])
            .mockResolvedValueOnce([
                { id: 1, nome: 'Alice' },
                { id: 2, nome: 'Bob' },
            ]);

        const service = new RelatorioExecuteService();
        const result = await service.execute({ id: 1, userId: 1, page: 1, pageSize: 50 });

        expect(result.data).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.columns).toEqual(['id', 'nome']);
        expect(result.executedQuery).toContain('SELECT * FROM');
        expect(result.executedQuery).toContain('OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY');
        expect(result.executedParams).toEqual([]);
        expect(s4DotzClient.relatorioExecucaoLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'SUCESSO' }) })
        );
    });

    it('deve registrar log de ERRO quando query falha', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);
        mockQueryRawUnsafe.mockRejectedValue(new Error('Syntax error'));

        const service = new RelatorioExecuteService();
        await expect(service.execute({ id: 1, userId: 1 })).rejects.toThrow();

        expect(s4DotzClient.relatorioExecucaoLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'ERRO' }) })
        );
    });

    it('deve retornar columns vazio quando resultado é vazio', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);
        mockQueryRawUnsafe
            .mockResolvedValueOnce([{ total: 0 }])
            .mockResolvedValueOnce([]);

        const service = new RelatorioExecuteService();
        const result = await service.execute({ id: 1, userId: 1 });

        expect(result.columns).toEqual([]);
        expect(result.data).toHaveLength(0);
    });
});
