import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendasProcessarService } from "../../../src/modules/vendas/services/VendasProcessarService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        vendasHeader: { updateMany: vi.fn() },
    },
}));

vi.mock("../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess", () => ({
    assertVendasHeaderCiaAccess: vi.fn(),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";
import { assertVendasHeaderCiaAccess } from "../../../src/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { VendasShowService } from "../../../src/modules/vendas/services/VendasShowService";

describe("VendasProcessarService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve alterar o status de CADASTRO para PENDENTE", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 18, ciaIdSAP: "CIA018", status: "CADASTRO" },
            cia: { id: 18 },
        });
        vi.mocked(s4DotzClient.vendasHeader.updateMany).mockResolvedValue({
            count: 1,
        });
        vi.spyOn(VendasShowService.prototype, "execute").mockResolvedValue({
            id: 18,
            status: "PENDENTE",
        } as never);

        const result = await new VendasProcessarService().execute({
            id: 18,
            ciaIds: [18],
        });

        expect(s4DotzClient.vendasHeader.updateMany).toHaveBeenCalledWith({
            where: { id: 18, status: "CADASTRO" },
            data: {
                status: "PENDENTE",
                atualizadoEm: expect.any(Date),
            },
        });
        expect(result).toMatchObject({ id: 18, status: "PENDENTE" });
    });

    it("deve rejeitar venda que não esteja em CADASTRO", async () => {
        vi.mocked(assertVendasHeaderCiaAccess).mockResolvedValue({
            header: { id: 18, ciaIdSAP: "CIA018", status: "PENDENTE" },
            cia: { id: 18 },
        });

        await expect(
            new VendasProcessarService().execute({ id: 18, ciaIds: [18] }),
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(s4DotzClient.vendasHeader.updateMany).not.toHaveBeenCalled();
    });
});
