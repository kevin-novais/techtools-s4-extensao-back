import * as XLSX from "xlsx";
import { formatCurrency } from "@/util/formatters/currency";

interface DetalheData {
    descricao: string;
    quantidade: string;
    precoUnitario: string;
    valorVenda: string;
}

interface VendasXLSXData {
    detalhes: DetalheData[];
    totalValorVenda: string;
}

export class VendasFaturaXLSXGenerator {
    execute(data: VendasXLSXData): Buffer {
        const rows = this.buildRows(data);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas");

        return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    }

    private buildRows(data: VendasXLSXData): (string | number)[][] {
        const rows: (string | number)[][] = [
            [
                "Descrição",
                "Quantidade",
                "Preço Unitário",
                "Vlr Venda",
            ],
        ];

        for (const detalhe of data.detalhes) {
            rows.push([
                detalhe.descricao,
                detalhe.quantidade,
                this.formatMoney(detalhe.precoUnitario),
                this.formatMoney(detalhe.valorVenda),
            ]);
        }

        rows.push([
            "TOTAL:",
            "",
            "",
            this.formatMoney(data.totalValorVenda),
        ]);

        return rows;
    }

    private formatMoney(value: string): string {
        if (!value || value === "N/A") {
            return "0,00";
        }

        return formatCurrency(value);
    }
}
