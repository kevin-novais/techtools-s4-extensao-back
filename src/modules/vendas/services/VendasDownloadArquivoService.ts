import path from "node:path";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { GCSStorage } from "@/providers/gcs-storage";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";

export type VendasArquivoTipo =
    | "relatorio-pdf"
    | "relatorio-xlsx"
    | "boleto"
    | "fatura-detalhada"
    | "relatorio-analitico";

const CONTENT_TYPES: Record<VendasArquivoTipo, string> = {
    "relatorio-pdf": "application/pdf",
    "relatorio-xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    boleto: "application/pdf",
    "fatura-detalhada": "application/octet-stream",
    "relatorio-analitico": "application/octet-stream",
};

interface VendasDownloadArquivoParams {
    vendasHeaderId: number;
    ciaIds: number[];
    tipo: VendasArquivoTipo;
}

interface VendasDownloadArquivoResult {
    stream: NodeJS.ReadableStream;
    filename: string;
    contentType: string;
}

export class VendasDownloadArquivoService {
    private readonly gcsStorage = new GCSStorage();

    async execute({ vendasHeaderId, ciaIds, tipo }: VendasDownloadArquivoParams): Promise<VendasDownloadArquivoResult> {
        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: {
                relatorioPdf: true,
                relatorioXlsx: true,
                pathBoleto: true,
                pathArquivoFaturaDetalhadaAnalyzer: true,
                pathArquivoRelatorioAnalitico: true,
            },
        });

        if (!venda) throw new AppError("Venda não encontrada", 404);

        const url = this.resolveUrl(venda, tipo);
        if (!url) throw new AppError("Arquivo não disponível para esta venda", 404);

        // O bucket é privado — só a service account autenticada (via GCSStorage) consegue ler o
        // objeto. Uma URL fora do formato storage.googleapis.com/{bucket}/{blob} indica dado
        // legado (nome de arquivo cru, de antes da migração pro GCS), sem arquivo real pra servir.
        let blobName: string;
        try {
            blobName = this.gcsStorage.extractBlobNameFromUrl(url);
        } catch {
            throw new AppError(
                "Arquivo desta venda está em um formato inválido — gere o relatório/boleto novamente",
                500,
            );
        }

        return {
            stream: this.gcsStorage.createReadStream(blobName),
            filename: path.basename(blobName),
            contentType: CONTENT_TYPES[tipo],
        };
    }

    private resolveUrl(
        venda: {
            relatorioPdf: string | null;
            relatorioXlsx: string | null;
            pathBoleto: string | null;
            pathArquivoFaturaDetalhadaAnalyzer: string | null;
            pathArquivoRelatorioAnalitico: string | null;
        },
        tipo: VendasArquivoTipo,
    ): string | null {
        if (tipo === "relatorio-pdf") return venda.relatorioPdf;
        if (tipo === "relatorio-xlsx") return venda.relatorioXlsx;
        if (tipo === "boleto") return venda.pathBoleto;
        if (tipo === "fatura-detalhada") {
            return venda.pathArquivoFaturaDetalhadaAnalyzer;
        }
        return venda.pathArquivoRelatorioAnalitico;
    }
}
