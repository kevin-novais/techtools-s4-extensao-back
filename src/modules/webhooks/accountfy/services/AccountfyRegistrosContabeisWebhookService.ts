import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateOnly } from "@/util/date";

interface AccountfyRegistrosContabeisWebhookInput {
    dataInicial: Date;
    dataFinal: Date;
    codEmpresa: string[];
    pagina: number;
    tamanho: number;
}

interface AccountfyItemResponse {
    DATA_LANCAMENTO: string;
    CODIGO_CONTA: string | null;
    DESC_CODIGO_CONTA: string | null;
    HISTORICO_LANCAMENTO: string;
    VALOR: number;
    DC: string | null;
    INF_ADIC_LANCAMENTO: string | null;
    CENTRO_CUSTO: string | null;
    COD_EMPRESA: string;
    NOME_EMPRESA: string | null;
    CNPJ: string | null;
}

interface AccountfyRegistrosContabeisWebhookResponse {
    CONTENT: {
        TOTAL_REGISTROS: number;
        PAGINA: number;
        TAMANHO: number;
    };
    ITENS: AccountfyItemResponse[];
}

type DecimalLike = { toNumber: () => number } | number | string | null | undefined;

interface AccountfyRegistroContabilRow {
    PostingDate: Date | null;
    GLAccount: string | null;
    GLAccountLongName: string | null;
    DocumentItemText: string | null;
    AccountingDocumentHeaderText: string | null;
    AmountInCompanyCodeCurrency: DecimalLike;
    DebitCreditCode: string | null;
    AssignmentReference: string | null;
    CostCenter: string | null;
    CompanyCode: string;
    CompanyCodeName: string | null;
}

export class AccountfyRegistrosContabeisWebhookService {
    async execute({
        dataInicial,
        dataFinal,
        codEmpresa,
        pagina,
        tamanho,
    }: AccountfyRegistrosContabeisWebhookInput): Promise<AccountfyRegistrosContabeisWebhookResponse> {
        const skip = (pagina - 1) * tamanho;

        const where = {
            PostingDate: {
                gte: dataInicial,
                lte: dataFinal,
            },
            ...(codEmpresa.length > 0 ? { CompanyCode: { in: codEmpresa } } : {}),
        };

        const [totalRegistros, registros] = await Promise.all([
            s4DotzClient.accountingDocumentItem.count({ where }),
            s4DotzClient.accountingDocumentItem.findMany({
                where,
                select: {
                    PostingDate: true,
                    GLAccount: true,
                    GLAccountLongName: true,
                    DocumentItemText: true,
                    AccountingDocumentHeaderText: true,
                    AmountInCompanyCodeCurrency: true,
                    DebitCreditCode: true,
                    AssignmentReference: true,
                    CostCenter: true,
                    CompanyCode: true,
                    CompanyCodeName: true,
                },
                orderBy: [
                    { PostingDate: "asc" },
                    { CompanyCode: "asc" },
                    { FiscalYear: "asc" },
                    { AccountingDocument: "asc" },
                    { AccountingDocumentItem: "asc" },
                ],
                skip,
                take: tamanho,
            }),
        ]);

        const registrosTyped = registros as AccountfyRegistroContabilRow[];

        const companyCodes = [...new Set(registrosTyped.map((r) => r.CompanyCode))];
        const cias = await s4DotzClient.cia.findMany({
            where: { ciaIdSAP: { in: companyCodes } },
            select: { ciaIdSAP: true, cpfCnpj: true },
        });
        const mapCnpj = new Map<string, string | null>();
        for (const cia of cias) {
            if (cia.ciaIdSAP) {
                mapCnpj.set(cia.ciaIdSAP, cia.cpfCnpj ?? null);
            }
        }

        const itens: AccountfyItemResponse[] = registrosTyped.map((registro: AccountfyRegistroContabilRow) => ({
            DATA_LANCAMENTO: formatDateOnly(registro.PostingDate),
            CODIGO_CONTA: registro.GLAccount ?? null,
            DESC_CODIGO_CONTA: registro.GLAccountLongName ?? null,
            HISTORICO_LANCAMENTO: [registro.AccountingDocumentHeaderText, registro.DocumentItemText]
                .filter(Boolean)
                .join(" ")
                .trim() || "",
            VALOR: Math.abs(this.parseDecimalValue(registro.AmountInCompanyCodeCurrency)),
            DC: registro.DebitCreditCode === "H" ? "C" : "D",
            INF_ADIC_LANCAMENTO: registro.AssignmentReference ?? null,
            CENTRO_CUSTO: registro.CostCenter ?? null,
            COD_EMPRESA: registro.CompanyCode,
            NOME_EMPRESA: registro.CompanyCodeName ?? null,
            CNPJ: mapCnpj.get(registro.CompanyCode) ?? null,
        }));

        return {
            CONTENT: {
                TOTAL_REGISTROS: totalRegistros,
                PAGINA: pagina,
                TAMANHO: tamanho,
            },
            ITENS: itens,
        };
    }

    private parseDecimalValue(value: DecimalLike): number {
        if (!value) {
            return 0;
        }

        if (typeof value === "number") {
            return value;
        }

        if (typeof value === "string") {
            const parsedValue = Number(value);
            return Number.isNaN(parsedValue) ? 0 : parsedValue;
        }

        return value.toNumber();
    }
}
