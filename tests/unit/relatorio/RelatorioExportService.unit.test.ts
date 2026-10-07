import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RelatorioExportService } from '../../../src/modules/relatorio/services/RelatorioExportService';

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
    nome: 'Teste Export',
    query: 'SELECT id, nome FROM usuarios',
    variaveis: [],
};

// EXPORT_CHUNK_SIZE do service — mantido em sincronia manualmente para o teste
// de múltiplas páginas forçar a segunda busca (chunk cheio -> segunda página).
const EXPORT_CHUNK_SIZE = 20_000;

function makeFakeResponse() {
    const chunks: Buffer[] = [];
    const res = new PassThrough() as PassThrough & { setHeader: ReturnType<typeof vi.fn>; headersSent: boolean };
    res.setHeader = vi.fn();
    res.headersSent = false;
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    return { res, getBuffer: () => Buffer.concat(chunks) };
}

async function readWorkbookRowCount(buffer: Buffer): Promise<number> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('Relatório')!;
    return worksheet.rowCount - 1; // exclui o header
}

describe('RelatorioExportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve lançar 404 quando relatório não existe (sem tocar na resposta)', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(null);
        const { res } = makeFakeResponse();

        const service = new RelatorioExportService();
        await expect(
            service.execute({ id: 999, userId: 1, res: res as never })
        ).rejects.toMatchObject({ message: 'Relatório não encontrado', statusCode: 404 });

        expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('deve exportar todas as linhas em streaming, buscando múltiplas páginas quando o chunk enche', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);

        const firstPage = Array.from({ length: EXPORT_CHUNK_SIZE }, (_, i) => ({ id: i + 1, nome: `Nome ${i + 1}` }));
        mockQueryRawUnsafe.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([]);

        const { res, getBuffer } = makeFakeResponse();
        const service = new RelatorioExportService();

        await service.execute({ id: 1, userId: 1, res: res as never });

        expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('relatorio-Teste_Export'));

        const rowCount = await readWorkbookRowCount(getBuffer());
        expect(rowCount).toBe(EXPORT_CHUNK_SIZE);

        expect(s4DotzClient.relatorioExecucaoLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'SUCESSO', totalLinhas: EXPORT_CHUNK_SIZE }) })
        );
    }, 20_000);

    it('não busca uma segunda página quando o primeiro chunk já vem incompleto', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);

        mockQueryRawUnsafe.mockResolvedValueOnce([
            { id: 1, nome: 'Alice' },
            { id: 2, nome: 'Bob' },
        ]);

        const { res, getBuffer } = makeFakeResponse();
        const service = new RelatorioExportService();

        await service.execute({ id: 1, userId: 1, res: res as never });

        expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
        const rowCount = await readWorkbookRowCount(getBuffer());
        expect(rowCount).toBe(2);
    });

    it('deve registrar log de ERRO e propagar o erro quando a query falha antes de qualquer linha ser escrita', async () => {
        vi.mocked(s4DotzClient.relatorio.findUnique).mockResolvedValue(mockRelatorio as never);
        vi.mocked(s4DotzClient.relatorioExecucaoLog.create).mockResolvedValue({} as never);
        mockQueryRawUnsafe.mockRejectedValue(new Error('Falha na query'));

        const { res } = makeFakeResponse();
        const service = new RelatorioExportService();

        await expect(service.execute({ id: 1, userId: 1, res: res as never })).rejects.toThrow();

        expect(s4DotzClient.relatorioExecucaoLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'ERRO' }) })
        );
    });
});
