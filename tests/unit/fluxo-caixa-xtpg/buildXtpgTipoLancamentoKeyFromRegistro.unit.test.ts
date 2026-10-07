import { describe, expect, it } from "vitest";
import { buildXtpgTipoLancamentoKeyFromRegistro } from "../../../src/cron/modules/fluxo-caixa-xtpg/utils/buildXtpgTipoLancamentoKeyFromRegistro";

describe("buildXtpgTipoLancamentoKeyFromRegistro", () => {
    it("retorna null quando postingKey ou documentType ou débito/crédito inválidos", () => {
        expect(
            buildXtpgTipoLancamentoKeyFromRegistro({
                CompanyCode: "1000",
                PostingKey: "",
                AccountingDocumentType: "SA",
                ReferenceDocumentType: "",
                IsReversed: null,
                ReversalReason: null,
                DebitCreditCode: "S",
            }),
        ).toBeNull();

        expect(
            buildXtpgTipoLancamentoKeyFromRegistro({
                CompanyCode: "1000",
                PostingKey: "40",
                AccountingDocumentType: "",
                ReferenceDocumentType: "",
                IsReversed: null,
                ReversalReason: null,
                DebitCreditCode: "S",
            }),
        ).toBeNull();

        expect(
            buildXtpgTipoLancamentoKeyFromRegistro({
                CompanyCode: "1000",
                PostingKey: "40",
                AccountingDocumentType: "SA",
                ReferenceDocumentType: "",
                IsReversed: null,
                ReversalReason: null,
                DebitCreditCode: "X",
            }),
        ).toBeNull();
    });

    it("monta chave normalizada alinhada ao cadastro de tipo de lançamento", () => {
        const k = buildXtpgTipoLancamentoKeyFromRegistro({
            CompanyCode: " 1000 ",
            PostingKey: "40",
            AccountingDocumentType: "SA",
            ReferenceDocumentType: "VZ",
            IsReversed: "X",
            ReversalReason: "01",
            DebitCreditCode: "h",
        });

        expect(k).toEqual({
            companyCode: "1000",
            postingKey: "40",
            documentType: "SA",
            referenceDocumentType: "VZ",
            isReversed: "X",
            reversalReason: "01",
            debitCreditCode: "H",
        });
    });
});
