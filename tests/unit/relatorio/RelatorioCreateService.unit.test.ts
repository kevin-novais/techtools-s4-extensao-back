import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RelatorioCreateService } from '../../../src/modules/relatorio/services/RelatorioCreateService';
import AppError from '../../../src/util/AppError';

vi.mock('../../../src/database/clients/s4DotzClient', () => {
    const mockRelatorio = { findFirst: vi.fn(), create: vi.fn() };
    return {
        default: {
            relatorio: mockRelatorio,
            $transaction: vi.fn(async (fn: any) => fn({ relatorio: mockRelatorio })),
        },
    };
});

import s4DotzClient from '../../../src/database/clients/s4DotzClient';

describe('RelatorioCreateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve rejeitar query com INSERT', async () => {
        const service = new RelatorioCreateService();
        await expect(
            service.execute({ nome: 'Teste', query: 'INSERT INTO t VALUES (1)', userId: 1 })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('deve rejeitar query com ponto-e-vírgula', async () => {
        const service = new RelatorioCreateService();
        await expect(
            service.execute({ nome: 'Teste', query: 'SELECT * FROM t;', userId: 1 })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('deve rejeitar se nome já existe', async () => {
        vi.mocked(s4DotzClient.relatorio.findFirst).mockResolvedValue({ id: 1 } as never);

        const service = new RelatorioCreateService();
        await expect(
            service.execute({ nome: 'Relatorio Duplicado', query: 'SELECT * FROM s4_extensao_dotz.dbo.t', userId: 1 })
        ).rejects.toMatchObject({ message: 'Já existe um relatório com esse nome', statusCode: 409 });
    });

    it('deve criar relatório com sucesso', async () => {
        vi.mocked(s4DotzClient.relatorio.findFirst).mockResolvedValue(null);
        vi.mocked(s4DotzClient.relatorio.create).mockResolvedValue({
            id: 1,
            nome: 'Meu Relatorio',
            query: 'SELECT * FROM s4_extensao_dotz.dbo.usuarios',
            criadoPor: { id: 1, nome: 'Admin' },
        } as never);

        const service = new RelatorioCreateService();
        const result = await service.execute({
            nome: 'Meu Relatorio',
            query: 'SELECT * FROM s4_extensao_dotz.dbo.usuarios',
            userId: 1,
        });

        expect(result).toHaveProperty('id', 1);
        expect(s4DotzClient.relatorio.create).toHaveBeenCalledOnce();
    });
});
