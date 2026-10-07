import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/modules/documento-fiscal/utils/formatDocumentoFiscalHeader", () => ({
    formatDocumentoFiscalHeader: vi.fn(() => ({ id: 10, mocked: true })),
}));

vi.mock("@/queue/producers/documentoFiscalProducer", () => ({
    publishProcessarDetalhes: vi.fn().mockResolvedValue(undefined),
    publishProcessarDetalhesPOS: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/database/clients/s4DotzClient", () => ({
    default: {
        documentoFiscalHeader: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        documentoFiscalDetalhe: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        usuarioGrupoUsuario: {
            findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
        },
    },
}));

import * as docProducer from "@/queue/producers/documentoFiscalProducer";
import { RomaneioRevalidarService } from "../../../src/modules/documento-fiscal/documento-header/romaneio/services/RomaneioRevalidarService";
import { StatusDocumento } from "../../../src/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "../../../src/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";

describe("RomaneioRevalidarService — sem novo arquivo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve falhar quando não há planilha armazenada e nenhum arquivo é enviado", async () => {
        vi.mocked(s4DotzClient.documentoFiscalHeader.findUnique).mockResolvedValue({
            id: 11,
            status: StatusDocumento.ERRO_INTEGRACAO,
            tipoDocumentoERP: TipoDocumentoERP.TP_ROM,
            romaneioUrl: null,
            codigoDocumento: "NFVENDA1",
            codigoFornecedorSAP: "V001",
            ciaId: 1,
            cia: { id: 1, nome: "CIA A" },
        } as any);

        const service = new RomaneioRevalidarService();

        await expect(service.execute({ documentoId: 11, usuarioId: 1 })).rejects.toMatchObject({
            statusCode: 400,
        });

        expect(docProducer.publishProcessarDetalhes).not.toHaveBeenCalled();
    });
});
