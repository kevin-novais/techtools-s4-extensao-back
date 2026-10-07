import * as XLSX from "xlsx";
import AppError from "@/util/AppError";
import log from "@/util/logger";

const REQUIRED_COLUMNS = [
    "NFVENDA",
    "QTDPROD",
    "DESCRICAO",
    "VLPROD",
    "VLFRETE",
    "COMBO",
    "VLRPEDIDO",
    "PEDIDO_PARCEIRO",
    "CHAVE_NFE",
];

export function validateXlsxColumns(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const headers: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cellValue = worksheet[cellAddress]?.v;
        if (cellValue) { 
            headers.push(String(cellValue).trim());
        }
    }

    log.info(`[validateXlsxColumns] Colunas encontradas na planilha: ${headers.join(", ")}`);

    const missingColumns = REQUIRED_COLUMNS.filter(
        (required) => !headers.includes(required)
    );

    if (missingColumns.length > 0) {
        log.warn(`[validateXlsxColumns] Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`);
        throw new AppError(
            `Arquivo inválido. Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`,
            400
        );
    }

    log.info(`[validateXlsxColumns] Todas as colunas obrigatórias foram encontradas`);
}

