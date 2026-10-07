import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendasCreateService } from "../../../src/modules/vendas/services/VendasCreateService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertCiaIdUsuarioAccess: vi.fn(),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertCiaIdUsuarioAccess } from "../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { VendasShowService } from "../../../src/modules/vendas/services/VendasShowService";

describe("VendasCreateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve criar a venda manual com status CADASTRO", async () => {
        vi.mocked(assertCiaIdUsuarioAccess).mockResolvedValue({
            id: 18,
            ciaIdSAP: "CIA018",
        });
        vi.mocked(s4DotzClient.vendasHeader.create).mockResolvedValue({
            id: 1,
        } as never);
        vi.spyOn(VendasShowService.prototype, "execute").mockResolvedValue({
            id: 1,
        } as never);

        const service = new VendasCreateService();

        await service.execute({
            data: {
                ciaId: 18,
                codigoClienteAnalyzer: "CLIENTE-18",
                cnpjCliente: "12345678000190",
                numeroDocumentoAnalyzer: "DOCUMENTO-18",
                dataEmissao: new Date("2026-07-01T00:00:00.000Z"),
                dataLancamentoContabil: new Date("2026-07-01T00:00:00.000Z"),
            },
            ciaIds: [18],
        });

        expect(s4DotzClient.vendasHeader.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                ciaIdSAP: "CIA018",
                tipoCadastro: "MANUAL",
                status: "CADASTRO",
                cnpjCliente: "12345678000190",
                dataVencimento: null,
            }),
        });
    });

    it("deve persistir no header os caminhos retornados pelo storage", async () => {
        vi.mocked(assertCiaIdUsuarioAccess).mockResolvedValue({
            id: 18,
            ciaIdSAP: "CIA018",
        });
        vi.mocked(s4DotzClient.vendasHeader.create).mockResolvedValue({
            id: 42,
        } as never);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({
            id: 42,
        } as never);
        vi.spyOn(VendasShowService.prototype, "execute").mockResolvedValue({
            id: 42,
        } as never);
        const anexosStorageService = {
            upload: vi.fn().mockResolvedValue({
                paths: {
                    pathArquivoFaturaDetalhadaAnalyzer:
                        "https://storage.example.com/ANEXOS_VENDA/42/fatura.xlsx",
                    pathArquivoRelatorioAnalitico:
                        "https://storage.example.com/ANEXOS_VENDA/42/relatorio.pdf",
                },
                storedFilenames: ["fatura.xlsx", "relatorio.pdf"],
            }),
            cleanupStoredFiles: vi.fn(),
        };

        const service = new VendasCreateService(anexosStorageService as never);
        const anexos = {
            arquivoFaturaDetalhada: { filename: "tmp-fatura" } as Express.Multer.File,
            arquivoRelatorioAnalitico: { filename: "tmp-relatorio" } as Express.Multer.File,
        };

        await service.execute({
            data: {
                ciaId: 18,
                codigoClienteAnalyzer: "CLIENTE-18",
                cnpjCliente: "12345678000190",
                numeroDocumentoAnalyzer: "DOCUMENTO-18",
                dataEmissao: new Date("2026-07-01T00:00:00.000Z"),
                dataLancamentoContabil: new Date("2026-07-01T00:00:00.000Z"),
                dataVencimento: new Date("2026-07-31T00:00:00.000Z"),
            },
            anexos,
            ciaIds: [18],
        });

        expect(anexosStorageService.upload).toHaveBeenCalledWith(42, anexos);
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: {
                pathArquivoFaturaDetalhadaAnalyzer:
                    "https://storage.example.com/ANEXOS_VENDA/42/fatura.xlsx",
                pathArquivoRelatorioAnalitico:
                    "https://storage.example.com/ANEXOS_VENDA/42/relatorio.pdf",
            },
        });
    });
});
