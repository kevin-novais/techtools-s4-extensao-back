import * as XLSX from "xlsx";
import { formatCpfCnpj } from "@/util/formatters/documentFormatter";
import { formatCurrency } from "@/util/formatters/currency";

interface DetalheData {
    data: string;
    cnpj: string;
    pedido: string;
    nome: string;
    codigo: string;
    parceiro: string;
    produto: string;
    descricao: string;
    valorProduto: string;
    frete: string;
}

interface DocumentoXLSXData {
    detalhes: DetalheData[];
    totalValorProduto: string;
    totalFrete: string;
}

export class DocumentoXLSXGenerator {
    execute(data: DocumentoXLSXData): Buffer {
        const rows = this.buildRows(data);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhes");

        return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    }

    private buildRows(data: DocumentoXLSXData): (string | number)[][] {
        const rows: (string | number)[][] = [
            [
                "Data",
                "CNPJ",
                "Pedido",
                "Nome",
                "Código",
                "Parceiro",
                "Produto",
                "Descrição",
                "Vlr Produto",
                "Frete",
            ],
        ];

        for (const detalhe of data.detalhes) {
            rows.push([
                detalhe.data,
                this.formatCnpj(detalhe.cnpj),
                detalhe.pedido,
                detalhe.nome,
                detalhe.codigo,
                detalhe.parceiro,
                detalhe.produto,
                detalhe.descricao,
                this.formatMoney(detalhe.valorProduto),
                this.formatMoney(detalhe.frete),
            ]);
        }

        rows.push([
            "TOTAL:",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            this.formatMoney(data.totalValorProduto),
            this.formatMoney(data.totalFrete),
        ]);

        return rows;
    }

    private formatCnpj(value: string): string {
        if (!value || value === "N/A") {
            return "N/A";
        }

        return formatCpfCnpj(value);
    }

    private formatMoney(value: string): string {
        if (!value || value === "N/A") {
            return "0,00";
        }

        return formatCurrency(value);
    }
}
