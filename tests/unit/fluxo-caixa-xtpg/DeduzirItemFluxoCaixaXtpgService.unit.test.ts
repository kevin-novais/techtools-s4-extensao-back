import { describe, expect, it, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { DeduzirItemFluxoCaixaXtpgService } from "../../../src/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        accountingDocumentItem: {
            findMany: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
        },
        contasContabeis: {
            findMany: vi.fn(),
        },
        fluxoCaixaCiaTipoLancamento: {
            findMany: vi.fn(),
        },
        fluxoCaixaCiaParceiro: {
            findMany: vi.fn(),
        },
        $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
        $executeRaw: vi.fn(() => Promise.resolve(0)),
    },
}));

vi.mock("../../../src/util/logger", () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

function lineBase(over: Record<string, unknown> = {}) {
    return {
        CompanyCode: "1000",
        FiscalYear: "2024",
        AccountingDocument: "1000000001",
        AccountingDocumentItem: "001",
        ChartOfAccounts: "YCOA",
        GLAccount: "11101001",
        ItemFluxodeCaixa: null,
        XtpgClassificacaoErro: null,
        PostingKey: null,
        AccountingDocumentType: null,
        ReferenceDocumentType: null,
        IsReversed: null,
        ReversalReason: null,
        DebitCreditCode: null,
        Supplier: null,
        Customer: null,
        ReverseDocument: null,
        ReverseDocumentFiscalYear: null,
        IsCleared: null,
        ClearingDocFiscalYear: null,
        ClearingAccountingDocument: null,
        ClearingItem: null,
        AmountInBalanceTransacCrcy: new Decimal(100),
        PostingDate: new Date("2024-06-01T00:00:00.000Z"),
        ...over,
    };
}

describe("DeduzirItemFluxoCaixaXtpgService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("nao reprocessa linha que ja falhou e reabre as de cadastro alterado", async () => {
        vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValueOnce([]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        await service.execute({ limit: 10 });

        // a reabertura roda antes da busca de candidatos
        expect(s4DotzClient.$executeRaw).toHaveBeenCalledTimes(1);

        // linha com erro registrado fica fora dos candidatos
        const where = vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mock.calls[0][0]?.where;
        expect(where).toMatchObject({ XtpgClassificacaoErro: null });
    });

    it("retorna zeros quando não há candidatos", async () => {
        vi.mocked(s4DotzClient.accountingDocumentItem.findMany).mockResolvedValueOnce([]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        const result = await service.execute({ limit: 10 });

        expect(result).toEqual({
            processed: 0,
            classified: 0,
            errorsSet: 0,
            skippedAlreadyValid: 0,
        });
    });

    it("classifica pelo item padrão da conta contábil (XTPG ativo)", async () => {
        const cand = lineBase({
            ItemFluxodeCaixa: null,
            PostingKey: null,
        });

        const contaRow = {
            ChartOfAccounts: "YCOA",
            CompanyCode: "1000",
            GLAccount: "11101001",
            ItemFluxoDeCaixa: "050",
            XtpgAtivado: true,
        };

        vi.mocked(s4DotzClient.accountingDocumentItem.findMany)
            .mockResolvedValueOnce([cand as never])
            .mockResolvedValueOnce([cand as never]);

        vi.mocked(s4DotzClient.contasContabeis.findMany)
            .mockResolvedValueOnce([contaRow as never])
            .mockResolvedValueOnce([contaRow as never]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        const result = await service.execute({ limit: 10 });

        expect(result.classified).toBe(1);
        expect(result.errorsSet).toBe(0);
        expect(s4DotzClient.$transaction).toHaveBeenCalledTimes(1);
    });

    it("copia item do documento original em reversão", async () => {
        const cand = lineBase({
            ItemFluxodeCaixa: null,
            ReverseDocument: "2000000001",
            ReverseDocumentFiscalYear: "2023",
            PostingKey: null,
        });

        const original = lineBase({
            FiscalYear: "2023",
            AccountingDocument: "2000000001",
            AccountingDocumentItem: "001",
            ItemFluxodeCaixa: "777",
            PostingKey: null,
        });

        const contaRow = {
            ChartOfAccounts: "YCOA",
            CompanyCode: "1000",
            GLAccount: "11101001",
            ItemFluxoDeCaixa: "",
            XtpgAtivado: true,
        };

        vi.mocked(s4DotzClient.accountingDocumentItem.findMany)
            .mockResolvedValueOnce([cand as never])
            .mockResolvedValueOnce([cand as never])
            .mockResolvedValueOnce([original as never]);

        vi.mocked(s4DotzClient.contasContabeis.findMany)
            .mockResolvedValueOnce([contaRow as never])
            .mockResolvedValueOnce([contaRow as never]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        const result = await service.execute({ limit: 10 });

        expect(result.classified).toBe(1);
        expect(result.errorsSet).toBe(0);
    });

    it("usa parametrização de tipo de lançamento quando demais regras não aplicam", async () => {
        const cand = lineBase({
            ItemFluxodeCaixa: null,
            PostingKey: "40",
            AccountingDocumentType: "SA",
            ReferenceDocumentType: "",
            IsReversed: "",
            ReversalReason: "",
            DebitCreditCode: "S",
        });

        const contaRow = {
            ChartOfAccounts: "YCOA",
            CompanyCode: "1000",
            GLAccount: "11101001",
            ItemFluxoDeCaixa: "",
            XtpgAtivado: true,
        };

        const tddRow = {
            companyCode: "1000",
            postingKey: "40",
            documentType: "SA",
            referenceDocumentType: "",
            isReversed: "",
            reversalReason: "",
            debitCreditCode: "S",
            itemFluxoCaixa: "TDD1",
        };

        vi.mocked(s4DotzClient.accountingDocumentItem.findMany)
            .mockResolvedValueOnce([cand as never])
            .mockResolvedValueOnce([cand as never]);

        vi.mocked(s4DotzClient.contasContabeis.findMany)
            .mockResolvedValueOnce([contaRow as never])
            .mockResolvedValueOnce([contaRow as never]);

        vi.mocked(s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany).mockResolvedValueOnce([tddRow as never]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        const result = await service.execute({ limit: 10 });

        expect(result.classified).toBe(1);
        expect(result.errorsSet).toBe(0);
    });

    it("marca erro quando conta não é elegível", async () => {
        const cand = lineBase({ ItemFluxodeCaixa: null, GLAccount: "99999999" });

        vi.mocked(s4DotzClient.accountingDocumentItem.findMany)
            .mockResolvedValueOnce([cand as never])
            .mockResolvedValueOnce([cand as never]);

        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        const service = new DeduzirItemFluxoCaixaXtpgService();
        const result = await service.execute({ limit: 10 });

        expect(result.classified).toBe(0);
        expect(result.errorsSet).toBe(1);
    });
});
