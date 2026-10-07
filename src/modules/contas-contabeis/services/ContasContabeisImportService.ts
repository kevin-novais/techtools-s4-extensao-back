import * as XLSX from "xlsx";
import path from "node:path";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import uploadConfig from "@/config/upload";
import { parseDateAsBrazilian } from "@/util/date";
import {
    validateContasContabeisXlsxColumns,
    getHeaderToCamelMap,
} from "@/modules/contas-contabeis/utils/validateContasContabeisXlsxColumns";
import log from "@/util/logger";

export interface ImportRowError {
    row: number;
    message: string;
}

export interface ContasContabeisImportResult {
    success: boolean;
    created: number;
    skipped: number;
    errors: ImportRowError[];
}

interface ContasContabeisRowPayload {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
    glAccountName: string;
    glAccountECD?: string;
    glAccountCosif?: string;
    glContaPaiCosif?: string;
    itemFluxoDeCaixa: string;
    glAccountB1Xtpg?: string;
    xtpgAtivado: boolean;
    dataInicio?: string;
    dataFim?: string;
}

export class ContasContabeisImportService {
    async execute(params: { filename: string }): Promise<ContasContabeisImportResult> {
        const { filename } = params;
        const filePath = path.resolve(uploadConfig.TMP_FOLDER, filename);

        const worksheet = this.readWorksheet(filePath);
        validateContasContabeisXlsxColumns(worksheet);
        const headerMap = getHeaderToCamelMap(worksheet);

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            raw: false,
            defval: "",
        });

        const { rows, errors } = this.parseAndValidateRows(rawRows, headerMap);

        if (errors.length > 0) {
            return {
                success: false,
                created: 0,
                skipped: 0,
                errors,
            };
        }

        let created = 0;
        let skipped = 0;

        for (const row of rows) {
            const exists = await s4DotzClient.contasContabeis.findUnique({
                where: {
                    ChartOfAccounts_CompanyCode_GLAccount: {
                        ChartOfAccounts: row.chartOfAccounts,
                        CompanyCode: row.companyCode,
                        GLAccount: row.glAccount,
                    },
                },
            });

            if (exists) {
                skipped++;
                continue;
            }

            await s4DotzClient.contasContabeis.create({
                data: {
                    ChartOfAccounts: row.chartOfAccounts,
                    CompanyCode: row.companyCode,
                    GLAccount: row.glAccount,
                    GLAccountName: row.glAccountName,
                    ...(row.glAccountECD != null &&
                        row.glAccountECD !== "" && { GLAccountECD: row.glAccountECD }),
                    ...(row.glAccountCosif != null &&
                        row.glAccountCosif !== "" && { GLAccountCosif: row.glAccountCosif }),
                    ...(row.glContaPaiCosif != null &&
                        row.glContaPaiCosif !== "" && { GLContaPaiCosif: row.glContaPaiCosif }),
                    ItemFluxoDeCaixa: row.itemFluxoDeCaixa,
                    ...(row.glAccountB1Xtpg != null &&
                        row.glAccountB1Xtpg !== "" && { GlAccountB1Xtpg: row.glAccountB1Xtpg }),
                    XtpgAtivado: row.xtpgAtivado,
                    ...(row.dataInicio != null &&
                        row.dataInicio !== "" && {
                            DataInicio: parseDateAsBrazilian(row.dataInicio),
                        }),
                    ...(row.dataFim != null &&
                        row.dataFim !== "" && {
                            DataFim: parseDateAsBrazilian(row.dataFim),
                        }),
                },
            });
            created++;
        }

        log.info(
            `[ContasContabeisImportService] Importação concluída: ${created} criadas, ${skipped} ignoradas (duplicatas)`
        );

        return {
            success: true,
            created,
            skipped,
            errors: [],
        };
    }

    private readWorksheet(filePath: string): XLSX.WorkSheet {
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.readFile(filePath);
        } catch (error) {
            log.error("[ContasContabeisImportService] Erro ao ler arquivo XLSX: %o", error);
            throw new AppError("Erro ao ler arquivo XLSX", 400);
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new AppError("Arquivo XLSX não contém planilhas", 400);
        }

        return workbook.Sheets[sheetName];
    }

    private parseAndValidateRows(
        rawRows: Record<string, unknown>[],
        headerMap: Record<string, string>
    ): { rows: ContasContabeisRowPayload[]; errors: ImportRowError[] } {
        const rows: ContasContabeisRowPayload[] = [];
        const errors: ImportRowError[] = [];

        for (let i = 0; i < rawRows.length; i++) {
            const excelRow = rawRows[i];
            const rowNumber = i + 2;

            const mapped = this.mapRowToCamel(excelRow, headerMap);
            const empty = Object.values(mapped).every(
                (v) => v == null || this.toSafeString(v).trim() === ""
            );
            if (empty) continue;

            const validationError = this.validateRow(mapped, rowNumber);
            if (validationError) {
                errors.push(validationError);
                continue;
            }

            rows.push({
                chartOfAccounts: this.toSafeString(mapped.chartOfAccounts).trim(),
                companyCode: this.toSafeString(mapped.companyCode).trim(),
                glAccount: this.toSafeString(mapped.glAccount).trim(),
                glAccountName: this.toSafeString(mapped.glAccountName).trim(),
                glAccountECD: this.optionalString(mapped.glAccountECD, 30),
                glAccountCosif: this.optionalString(mapped.glAccountCosif, 30),
                glContaPaiCosif: this.optionalString(mapped.glContaPaiCosif, 30),
                itemFluxoDeCaixa: this.toSafeString(mapped.itemFluxoDeCaixa).trim(),
                glAccountB1Xtpg: this.optionalString(mapped.glAccountB1Xtpg, 30),
                xtpgAtivado: this.parseXtpgAtivado(mapped.xtpgAtivado),
                dataInicio: this.normalizeDateString(mapped.dataInicio),
                dataFim: this.normalizeDateString(mapped.dataFim),
            });
        }

        return { rows, errors };
    }

    private mapRowToCamel(
        row: Record<string, unknown>,
        headerMap: Record<string, string>
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            const camelKey = headerMap[key] ?? headerMap[String(key).trim()];
            if (camelKey) {
                result[camelKey] = value;
            }
        }
        return result;
    }

    private parseXtpgAtivado(val: unknown): boolean {
        if (val == null) return false;
        const s = this.toSafeString(val).trim().toLowerCase();
        if (s === "") return false;
        if (s === "true" || s === "1" || s === "s" || s === "sim" || s === "x") return true;
        if (s === "false" || s === "0" || s === "n" || s === "nao" || s === "não") return false;
        return false;
    }

    private toSafeString(val: unknown): string {
        if (val == null) return "";
        if (typeof val === "string") return val;
        if (typeof val === "number") return String(val);
        if (val instanceof Date) return val.toISOString().split("T")[0];
        return "";
    }

    private optionalString(val: unknown, maxLen: number): string | undefined {
        if (val == null) return undefined;
        const s = this.toSafeString(val).trim();
        if (s === "") return undefined;
        if (s.length > maxLen) return undefined;
        return s;
    }

    private normalizeDateString(val: unknown): string | undefined {
        if (val == null) return undefined;
        const s = this.toSafeString(val).trim();
        if (s === "") return undefined;

        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

        const dateBrRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const brMatch = dateBrRegex.exec(s);
        if (brMatch) {
            const [, day, month, year] = brMatch;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        const num = Number(val);
        if (!Number.isNaN(num) && num > 0) {
            try {
                const date = XLSX.SSF.parse_date_code(num);
                if (date?.y && date?.m && date?.d) {
                    const y = date.y;
                    const m = String(date.m).padStart(2, "0");
                    const d = String(date.d).padStart(2, "0");
                    return `${y}-${m}-${d}`;
                }
            } catch {
                // ignore invalid serial
            }
        }

        return undefined;
    }

    private validateRequired(
        value: string,
        fieldName: string,
        maxLen: number,
        rowNumber: number
    ): ImportRowError | null {
        if (!value) return { row: rowNumber, message: `${fieldName} é obrigatório` };
        if (value.length > maxLen) {
            return { row: rowNumber, message: `${fieldName} deve ter no máximo ${maxLen} caracteres` };
        }
        return null;
    }

    private validateOptionalMax(
        mapped: Record<string, unknown>,
        key: string,
        maxLen: number,
        rowNumber: number,
        fieldName: string
    ): ImportRowError | null {
        const parsed = this.optionalString(mapped[key], maxLen);
        if (this.toSafeString(mapped[key]).trim() !== "" && !parsed) {
            return { row: rowNumber, message: `${fieldName} deve ter no máximo ${maxLen} caracteres` };
        }
        return null;
    }

    private validateOptionalDate(
        mapped: Record<string, unknown>,
        key: string,
        rowNumber: number,
        fieldName: string
    ): ImportRowError | null {
        const parsed = this.normalizeDateString(mapped[key]);
        if (this.toSafeString(mapped[key]).trim() !== "" && !parsed) {
            return { row: rowNumber, message: `${fieldName} inválida (use YYYY-MM-DD ou dd/MM/yyyy)` };
        }
        return null;
    }

    private validateRow(
        mapped: Record<string, unknown>,
        rowNumber: number
    ): ImportRowError | null {
        const chartOfAccounts = this.toSafeString(mapped.chartOfAccounts).trim();
        const companyCode = this.toSafeString(mapped.companyCode).trim();
        const glAccount = this.toSafeString(mapped.glAccount).trim();
        const glAccountName = this.toSafeString(mapped.glAccountName).trim();
        const itemFluxoDeCaixa = this.toSafeString(mapped.itemFluxoDeCaixa).trim();

        const err =
            this.validateRequired(chartOfAccounts, "chartOfAccounts", 10, rowNumber) ??
            this.validateRequired(companyCode, "companyCode", 10, rowNumber) ??
            this.validateRequired(glAccount, "glAccount", 30, rowNumber) ??
            this.validateRequired(glAccountName, "glAccountName", 100, rowNumber) ??
            this.validateOptionalMax(mapped, "glAccountECD", 30, rowNumber, "glAccountECD") ??
            this.validateOptionalMax(mapped, "glAccountCosif", 30, rowNumber, "glAccountCosif") ??
            this.validateOptionalMax(mapped, "glContaPaiCosif", 30, rowNumber, "glContaPaiCosif") ??
            this.validateOptionalMax(mapped, "glAccountB1Xtpg", 30, rowNumber, "glAccountB1Xtpg") ??
            this.validateRequired(itemFluxoDeCaixa, "itemFluxoDeCaixa", 20, rowNumber) ??
            this.validateOptionalDate(mapped, "dataInicio", rowNumber, "dataInicio") ??
            this.validateOptionalDate(mapped, "dataFim", rowNumber, "dataFim");

        return err;
    }
}
