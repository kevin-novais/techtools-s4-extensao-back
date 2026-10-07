import { describe, expect, it, vi } from "vitest";
import { VendasAnexosStorageService } from "../../../src/modules/vendas/services/VendasAnexosStorageService";

describe("VendasAnexosStorageService", () => {
    it("salva os anexos no diretório do header mantendo o nome sanitizado", async () => {
        const gcsStorage = {
            saveFile: vi
                .fn()
                .mockResolvedValueOnce("ANEXOS_VENDA/18/fatura_detalhada.xlsx")
                .mockResolvedValueOnce("ANEXOS_VENDA/18/relatorio_analitico.pdf"),
            getPublicUrl: vi.fn(
                (blobName: string) => `https://storage.example.com/${blobName}`,
            ),
            deleteFile: vi.fn(),
            deleteTmpFile: vi.fn(),
        };
        const service = new VendasAnexosStorageService(gcsStorage as never);

        const result = await service.upload(18, {
            arquivoFaturaDetalhada: {
                filename: "hash-fatura.xlsx",
                originalname: "fatura detalhada.xlsx",
            } as Express.Multer.File,
            arquivoRelatorioAnalitico: {
                filename: "hash-relatorio.pdf",
                originalname: "relatório analítico.pdf",
            } as Express.Multer.File,
        });

        expect(gcsStorage.saveFile).toHaveBeenNthCalledWith(
            1,
            "hash-fatura.xlsx",
            "ANEXOS_VENDA/18",
            "fatura_detalhada.xlsx",
        );
        expect(gcsStorage.saveFile).toHaveBeenNthCalledWith(
            2,
            "hash-relatorio.pdf",
            "ANEXOS_VENDA/18",
            "relatorio_analitico.pdf",
        );
        expect(result.paths).toEqual({
            pathArquivoFaturaDetalhadaAnalyzer:
                "https://storage.example.com/ANEXOS_VENDA/18/fatura_detalhada.xlsx",
            pathArquivoRelatorioAnalitico:
                "https://storage.example.com/ANEXOS_VENDA/18/relatorio_analitico.pdf",
        });
    });
});
