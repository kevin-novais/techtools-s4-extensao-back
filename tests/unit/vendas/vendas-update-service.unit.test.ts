import { describe, expect, it, vi, beforeEach } from "vitest";
import { VendasUpdateService } from "../../../src/modules/vendas/services/VendasUpdateService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        cia: { findFirst: vi.fn() },
        vendasHeader: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: vi.fn(),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertVendasHeaderCiaAccess } from "../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { VendasShowService } from "../../../src/modules/vendas/services/VendasShowService";

describe("VendasUpdateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve propagar erro quando header não é editável", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockRejectedValue(
            new AppError("Venda não pode ser alterada manualmente no status atual", 400),
        );

        const service = new VendasUpdateService();

        await expect(
            service.execute({
                id: 1,
                data: { codigoClienteSAP: "C001" },
                ciaIds: [1],
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("deve atualizar venda e retornar show", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 1, ciaIdSAP: 100, status: "PENDENTE" },
            cia: { id: 1 },
        });
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            dataEmissao: new Date("2026-05-01"),
            dataLancamentoContabil: new Date("2026-05-01"),
            dataVencimento: new Date("2026-05-31"),
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({ id: 1 } as any);
        vi.spyOn(VendasShowService.prototype, "execute").mockResolvedValue({
            id: 1,
            codigoClienteSAP: "C002",
        } as any);

        const service = new VendasUpdateService();
        const result = await service.execute({
            id: 1,
            data: { codigoClienteSAP: "C002" },
            ciaIds: [1],
        });

        expect(result).toMatchObject({ id: 1, codigoClienteSAP: "C002" });
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ codigoClienteSAP: "C002" }),
            }),
        );
    });

    it("deve armazenar um novo anexo ao editar a venda", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 1, ciaIdSAP: "CIA001", status: "PENDENTE" },
            cia: { id: 1 },
        });
        vi.mocked(s4DotzClient.vendasHeader.findUnique).mockResolvedValue({
            id: 1,
            dataEmissao: new Date("2026-05-01"),
            dataLancamentoContabil: new Date("2026-05-01"),
            dataVencimento: new Date("2026-05-31"),
        } as any);
        vi.mocked(s4DotzClient.vendasHeader.update).mockResolvedValue({ id: 1 } as any);
        vi.spyOn(VendasShowService.prototype, "execute").mockResolvedValue({ id: 1 } as any);
        const anexosStorageService = {
            upload: vi.fn().mockResolvedValue({
                paths: {
                    pathArquivoFaturaDetalhadaAnalyzer:
                        "https://storage.example.com/ANEXOS_VENDA/1/fatura.xlsx",
                },
                storedFilenames: ["fatura.xlsx"],
            }),
        };
        const anexo = { filename: "tmp-fatura" } as Express.Multer.File;

        const service = new VendasUpdateService(anexosStorageService as never);
        await service.execute({
            id: 1,
            data: {},
            anexos: { arquivoFaturaDetalhada: anexo },
            ciaIds: [1],
        });

        expect(anexosStorageService.upload).toHaveBeenCalledWith(1, {
            arquivoFaturaDetalhada: anexo,
        });
        expect(s4DotzClient.vendasHeader.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: expect.objectContaining({
                pathArquivoFaturaDetalhadaAnalyzer:
                    "https://storage.example.com/ANEXOS_VENDA/1/fatura.xlsx",
            }),
        });
    });
});
