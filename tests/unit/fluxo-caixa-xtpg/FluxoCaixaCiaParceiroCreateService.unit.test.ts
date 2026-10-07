import { describe, expect, it, vi, beforeEach } from "vitest";
import { FluxoCaixaCiaParceiroCreateService } from "../../../src/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaParceiroCreateService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        fluxoCaixaCiaParceiro: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("FluxoCaixaCiaParceiroCreateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("retorna 409 quando vínculo já existe", async () => {
        vi.mocked(s4DotzClient.fluxoCaixaCiaParceiro.findUnique).mockResolvedValue({
            cardCode: "V100",
            companyCode: "",
            itemFluxoCaixa: "001",
        } as never);

        const service = new FluxoCaixaCiaParceiroCreateService();

        await expect(
            service.execute({
                cardCode: "V100",
                companyCode: "",
                itemFluxoCaixa: "002",
                usuarioId: 1,
                validateOcrExists: false,
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
            message: "Vínculo já existe para este parceiro e código de empresa",
        });

        expect(s4DotzClient.fluxoCaixaCiaParceiro.create).not.toHaveBeenCalled();
    });
});
