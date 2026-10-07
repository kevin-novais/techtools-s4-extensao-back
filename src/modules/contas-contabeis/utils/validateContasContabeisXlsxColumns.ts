import * as XLSX from "xlsx";
import AppError from "@/util/AppError";
import log from "@/util/logger";

const REQUIRED_COLUMNS_CAMEL = [
    "chartOfAccounts",
    "companyCode",
    "glAccount",
    "glAccountName",
    "itemFluxoDeCaixa",
];

const OPTIONAL_COLUMNS_CAMEL = [
    "glAccountECD",
    "glAccountCosif",
    "glContaPaiCosif",
    "glAccountB1Xtpg",
    "xtpgAtivado",
    "dataInicio",
    "dataFim",
];

const HEADER_ALIASES: Record<string, string[]> = {
    chartOfAccounts: ["chartOfAccounts", "chart_of_accounts"],
    companyCode: ["companyCode", "company_code"],
    glAccount: ["glAccount", "gl_account"],
    glAccountName: ["glAccountName", "gl_account_name"],
    glAccountECD: ["glAccountECD", "gl_account_ecd", "glAccountEcd"],
    glAccountCosif: ["glAccountCosif", "gl_account_cosif"],
    glContaPaiCosif: ["glContaPaiCosif", "gl_conta_pai_cosif"],
    itemFluxoDeCaixa: ["itemFluxoDeCaixa", "item_fluxo_de_caixa"],
    glAccountB1Xtpg: ["glAccountB1Xtpg", "gl_account_b1_xtpg", "contaContabilB1Xtpg"],
    xtpgAtivado: ["xtpgAtivado", "xtpg_ativado"],
    dataInicio: ["dataInicio", "data_inicio"],
    dataFim: ["dataFim", "data_fim"],
};

function normalizeHeader(header: string): string | null {
    const trimmed = String(header || "").trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.some((a) => a.toLowerCase() === lower)) return canonical;
    }

    const snakeToCamel = trimmed
        .replaceAll(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        .replaceAll(/^[a-z]/g, (letter) => letter.toLowerCase());
    return snakeToCamel;
}

export function validateContasContabeisXlsxColumns(worksheet: XLSX.WorkSheet): string[] {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const headersRaw: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cellValue = worksheet[cellAddress]?.v;
        if (cellValue) {
            headersRaw.push(String(cellValue).trim());
        }
    }

    const headersNormalized = headersRaw
        .map((h) => normalizeHeader(h))
        .filter((h): h is string => h != null);
    log.info(`[validateContasContabeisXlsxColumns] Colunas encontradas: ${headersRaw.join(", ")}`);

    const missingColumns = REQUIRED_COLUMNS_CAMEL.filter(
        (required) => !headersNormalized.includes(required)
    );

    if (missingColumns.length > 0) {
        log.warn(
            `[validateContasContabeisXlsxColumns] Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`
        );
        throw new AppError(
            `Arquivo inválido. Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`,
            400
        );
    }

    log.info(`[validateContasContabeisXlsxColumns] Todas as colunas obrigatórias foram encontradas`);
    return headersNormalized;
}

export function getHeaderToCamelMap(worksheet: XLSX.WorkSheet): Record<string, string> {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const map: Record<string, string> = {};

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cellValue = worksheet[cellAddress]?.v;
        if (cellValue) {
            const raw = String(cellValue).trim();
            const camel = normalizeHeader(raw);
            if (camel) {
                map[raw] = camel;
                map[camel] = camel;
            }
        }
    }

    return map;
}

export const CONTAS_CONTABEIS_XLSX_COLUMNS = [
    ...REQUIRED_COLUMNS_CAMEL,
    ...OPTIONAL_COLUMNS_CAMEL,
] as const;
