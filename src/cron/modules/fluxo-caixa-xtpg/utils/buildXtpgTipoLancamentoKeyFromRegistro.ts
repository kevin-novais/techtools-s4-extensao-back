import type { AccountingDocumentItem } from "@prisma/client-s4-dotz";
import {
    normalizeDebitCreditKey,
    normalizeIsReversedKey,
    normalizeReversalReasonKey,
    normalizeXtpgCompanyCode,
} from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

export type XtpgTipoLancamentoKeyNormalized = {
    companyCode: string;
    postingKey: string;
    documentType: string;
    referenceDocumentType: string;
    isReversed: string;
    reversalReason: string;
    debitCreditCode: string;
};

export function buildXtpgTipoLancamentoKeyFromRegistro(
    line: Pick<
        AccountingDocumentItem,
        | "CompanyCode"
        | "PostingKey"
        | "AccountingDocumentType"
        | "ReferenceDocumentType"
        | "IsReversed"
        | "ReversalReason"
        | "DebitCreditCode"
    >,
): XtpgTipoLancamentoKeyNormalized | null {
    const postingKey = (line.PostingKey ?? "").trim().slice(0, 2);
    if (!postingKey) return null;

    const documentType = (line.AccountingDocumentType ?? "").trim().slice(0, 2);
    if (!documentType) return null;

    const debitCreditCode = normalizeDebitCreditKey(line.DebitCreditCode ?? "").slice(0, 1);
    if (debitCreditCode !== "S" && debitCreditCode !== "H") return null;

    return {
        companyCode: normalizeXtpgCompanyCode(line.CompanyCode),
        postingKey,
        documentType,
        referenceDocumentType: (line.ReferenceDocumentType ?? "").trim().slice(0, 10),
        isReversed: normalizeIsReversedKey(line.IsReversed),
        reversalReason: normalizeReversalReasonKey(line.ReversalReason),
        debitCreditCode,
    };
}

export function xtpgTipoLancamentoKeyToString(key: XtpgTipoLancamentoKeyNormalized): string {
    return JSON.stringify(key);
}
