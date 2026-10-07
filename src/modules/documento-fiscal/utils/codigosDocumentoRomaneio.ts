import * as XLSX from "xlsx";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import type { RomaneioRow } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

/**
 * Normaliza o código do documento para comparação (remove espaços das pontas).
 */
export function normalizarCodigoDocumento(valor: unknown): string {
    return String(valor ?? "").trim();
}

/**
 * Extrai os códigos de documento distintos da planilha de romaneio, na ordem de
 * aparição. Um arquivo pode conter mais de um documento: cada código gera um header.
 *
 * @throws AppError se a planilha estiver vazia ou se alguma linha estiver sem código
 * (linha sem código não pertenceria a nenhum documento)
 */
export function extrairCodigosDocumento(worksheet: XLSX.WorkSheet, columnName: string): string[] {
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    if (data.length === 0) {
        throw new AppError("Planilha não contém dados", 400);
    }

    const linhasSemCodigo = data.filter(
        (row) => normalizarCodigoDocumento(row[columnName]) === ""
    ).length;

    if (linhasSemCodigo > 0) {
        throw new AppError(
            `Coluna "${columnName}" deve estar preenchida em todas as linhas. ${linhasSemCodigo} linha(s) sem código encontrada(s)`,
            400
        );
    }

    const codigos = Array.from(
        new Set(data.map((row) => normalizarCodigoDocumento(row[columnName])))
    );

    log.info(
        `[extrairCodigosDocumento] ${data.length} linha(s) na planilha, ${codigos.length} documento(s): ${codigos.join(", ")}`
    );

    return codigos;
}

/**
 * Filtra as linhas pertencentes a um único documento, ignorando os demais
 * documentos presentes no mesmo arquivo.
 */
export function filtrarLinhasPorDocumento(rows: RomaneioRow[], codigoDocumento: string): RomaneioRow[] {
    const alvo = normalizarCodigoDocumento(codigoDocumento);
    return rows.filter((row) => normalizarCodigoDocumento(row.NFVENDA) === alvo);
}
