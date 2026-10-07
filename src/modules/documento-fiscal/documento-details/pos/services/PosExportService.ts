import * as XLSX from "xlsx";
import getDotzStageClient from "@/database/clients/dotzStageClient";
import { PosFormatter, PosItem } from "@/modules/documento-fiscal/documento-details/pos/services/PosFormatter";
import { PosRawQueryRepository } from "@/modules/documento-fiscal/documento-details/pos/services/PosRawQueryRepository";

interface PosExportParams {
    dataEmissaoDe?: string;
    dataEmissaoAte?: string;
    dataVencimentoDe?: string;
    dataVencimentoAte?: string;
    segmento?: string;
    filterModel?: string;
    sortModel?: string;
}

interface PosExportCountResponse {
    totalItems: number;
}

export class PosExportService {
    async count(params: PosExportParams = {}): Promise<PosExportCountResponse> {
        const totalItems = await new PosRawQueryRepository().count(params);

        return { totalItems };
    }

    async execute(params: PosExportParams = {}): Promise<Buffer> {
        const client = getDotzStageClient();
        const linhas = await new PosRawQueryRepository().findManyDetails(params);

        const parentMap = await PosFormatter.buildParentNameMap(linhas, client);
        const documentos = PosFormatter.formatResponse(linhas, parentMap);

        const rows = this.buildRows(documentos);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos POS");

        return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    }

    private buildRows(documentos: PosItem[]): (string | number | null)[][] {
        const header = [
            "posId",
            "grupoCodigo",
            "grupoNome",
            "dataPedido",
            "dataVencimento",
            "codigoParceiro",
            "parceiro",
            "docPedido",
            "pedAnalyzer",
            "item",
            "descricao",
            "quantidade",
            "preco",
            "total",
            "tipoItem",
        ];
        const rows: (string | number | null)[][] = [header];

        for (const d of documentos) {
            rows.push([
                d.posId,
                d.grupoCodigo,
                d.grupoNome,
                d.dataPedido,
                d.dataVencimento,
                d.codigoParceiro,
                d.parceiro,
                d.docPedido,
                d.pedAnalyzer,
                d.item,
                d.descricao,
                d.quantidade,
                d.preco,
                d.total,
                d.tipoItem,
            ]);
        }

        return rows;
    }
}
