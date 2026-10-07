import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContasContabeisCreateService } from "../../../src/modules/contas-contabeis/services/ContasContabeisCreateService";
import { ContasContabeisListService } from "../../../src/modules/contas-contabeis/services/ContasContabeisListService";
import { ContasContabeisShowService } from "../../../src/modules/contas-contabeis/services/ContasContabeisShowService";
import { ContasContabeisUpdateService } from "../../../src/modules/contas-contabeis/services/ContasContabeisUpdateService";
import { ContasContabeisDeleteService } from "../../../src/modules/contas-contabeis/services/ContasContabeisDeleteService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        contasContabeis: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
    },
}));

vi.mock("../../../src/util/date", () => ({
    formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
    formatDateOnly: vi.fn((d: Date) => (d ? d.toISOString().split("T")[0] : "")),
    parseDateAsBrazilian: vi.fn((s: string) => new Date(s)),
    parseDateForFilter: vi.fn((s: string) => new Date(s)),
    parseDateForFilterEnd: vi.fn((s: string) => new Date(s)),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

const compositeWhere = {
    ChartOfAccounts_CompanyCode_GLAccount: {
        ChartOfAccounts: "PLAN",
        CompanyCode: "1000",
        GLAccount: "1.1.01.001",
    },
};

describe("ContasContabeisCreateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 400 quando conta já existe", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
        } as any);

        const service = new ContasContabeisCreateService();
        const promise = service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            glAccountName: "Conta Teste",
            glAccountECD: "ECD",
            glAccountCosif: "COSIF",
            glContaPaiCosif: "PAI",
            itemFluxoDeCaixa: "001",
            dataInicio: "2026-01-01",
            dataFim: "2026-12-31",
        });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta contábil já cadastrada para este plano de contas, empresa e conta",
            statusCode: 400,
        });
    });

    it("deve criar conta com sucesso e retornar objeto formatado", async () => {
        const contaCriada = {
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
            GLAccountName: "Conta Teste",
            GLAccountECD: "ECD",
            GLAccountCosif: "COSIF",
            GLContaPaiCosif: "PAI",
            ItemFluxoDeCaixa: "001",
            DataInicio: new Date("2026-01-01"),
            DataAlteracao: new Date("2026-03-10T12:00:00Z"),
            DataFim: new Date("2026-12-31"),
        };

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasContabeis.create).mockResolvedValue(contaCriada as any);

        const service = new ContasContabeisCreateService();
        const result = await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            glAccountName: "Conta Teste",
            glAccountECD: "ECD",
            glAccountCosif: "COSIF",
            glContaPaiCosif: "PAI",
            itemFluxoDeCaixa: "001",
            dataInicio: "2026-01-01",
            dataFim: "2026-12-31",
        });

        expect(result).toMatchObject({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            glAccountName: "Conta Teste",
        });
        expect(s4DotzClient.contasContabeis.create).toHaveBeenCalledOnce();
    });

    it("deve criar conta com campos opcionais omitidos", async () => {
        const contaCriada = {
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.002",
            GLAccountName: "Conta Teste 2",
            GLAccountECD: null,
            GLAccountCosif: null,
            GLContaPaiCosif: null,
            ItemFluxoDeCaixa: "001",
            DataInicio: null,
            DataAlteracao: null,
            DataFim: null,
        };

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasContabeis.create).mockResolvedValue(contaCriada as any);

        const service = new ContasContabeisCreateService();
        const result = await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.002",
            glAccountName: "Conta Teste 2",
            itemFluxoDeCaixa: "001",
        });

        expect(result).toMatchObject({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.002",
            glAccountName: "Conta Teste 2",
            glAccountECD: null,
            glAccountCosif: null,
            glContaPaiCosif: null,
            dataInicio: null,
            dataAlteracao: null,
            dataFim: null,
        });
        expect(s4DotzClient.contasContabeis.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                ChartOfAccounts: "PLAN",
                CompanyCode: "1000",
                GLAccount: "1.1.01.002",
                GLAccountName: "Conta Teste 2",
                ItemFluxoDeCaixa: "001",
            }),
        });
        expect(s4DotzClient.contasContabeis.create).toHaveBeenCalledOnce();
    });
});

describe("ContasContabeisListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve retornar lista com paginação correta", async () => {
        const contas = [
            {
                ChartOfAccounts: "PLAN",
                CompanyCode: "1000",
                GLAccount: "1.1.01.001",
                GLAccountName: "Conta 1",
                GLAccountECD: "ECD1",
                GLAccountCosif: "COSIF1",
                GLContaPaiCosif: "PAI1",
                ItemFluxoDeCaixa: "001",
                DataInicio: new Date("2026-01-01"),
                DataAlteracao: new Date("2026-03-10T12:00:00Z"),
                DataFim: new Date("2026-12-31"),
            },
            {
                ChartOfAccounts: "PLAN",
                CompanyCode: "1000",
                GLAccount: "1.1.01.002",
                GLAccountName: "Conta 2",
                GLAccountECD: "ECD2",
                GLAccountCosif: "COSIF2",
                GLContaPaiCosif: "PAI2",
                ItemFluxoDeCaixa: "002",
                DataInicio: new Date("2026-01-01"),
                DataAlteracao: new Date("2026-03-10T12:00:00Z"),
                DataFim: new Date("2026-12-31"),
            },
        ];

        vi.mocked(s4DotzClient.contasContabeis.count).mockResolvedValue(5);
        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValue(contas as any);

        const service = new ContasContabeisListService();
        const result = await service.execute({ page: 1, limit: 2 });

        expect(result.contasContabeis).toHaveLength(2);
        expect(result.pagination).toMatchObject({
            currentPage: 1,
            totalItems: 5,
            totalPages: 3,
            itemsPerPage: 2,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });

    it("deve retornar campos opcionais como null quando não preenchidos", async () => {
        const contas = [
            {
                ChartOfAccounts: "PLAN",
                CompanyCode: "1000",
                GLAccount: "1.1.01.003",
                GLAccountName: "Conta com nulls",
                GLAccountECD: null,
                GLAccountCosif: null,
                GLContaPaiCosif: null,
                ItemFluxoDeCaixa: "001",
                DataInicio: null,
                DataAlteracao: null,
                DataFim: null,
            },
        ];

        vi.mocked(s4DotzClient.contasContabeis.count).mockResolvedValue(1);
        vi.mocked(s4DotzClient.contasContabeis.findMany).mockResolvedValue(contas as any);

        const service = new ContasContabeisListService();
        const result = await service.execute({ page: 1, limit: 10 });

        expect(result.contasContabeis[0]).toMatchObject({
            glAccountECD: null,
            glAccountCosif: null,
            glContaPaiCosif: null,
            dataInicio: null,
            dataAlteracao: null,
            dataFim: null,
        });
    });
});

describe("ContasContabeisShowService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);

        const service = new ContasContabeisShowService();
        const promise = service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "999",
        });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta contábil não encontrada",
            statusCode: 404,
        });
    });

    it("deve retornar conta formatada quando encontrada", async () => {
        const conta = {
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
            GLAccountName: "Conta Teste",
            GLAccountECD: "ECD",
            GLAccountCosif: "COSIF",
            GLContaPaiCosif: "PAI",
            ItemFluxoDeCaixa: "001",
            DataInicio: new Date("2026-01-01"),
            DataAlteracao: new Date("2026-03-10T12:00:00Z"),
            DataFim: new Date("2026-12-31"),
        };

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(conta as any);

        const service = new ContasContabeisShowService();
        const result = await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
        });

        expect(result).toMatchObject({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            glAccountName: "Conta Teste",
        });
    });
});

describe("ContasContabeisUpdateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);

        const service = new ContasContabeisUpdateService();
        const promise = service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "999",
            data: { glAccountName: "Novo Nome" },
        });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta contábil não encontrada",
            statusCode: 404,
        });
    });

    it("deve atualizar conta com sucesso", async () => {
        const contaAtualizada = {
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
            GLAccountName: "Nome Atualizado",
            GLAccountECD: "ECD",
            GLAccountCosif: "COSIF",
            GLContaPaiCosif: "PAI",
            ItemFluxoDeCaixa: "001",
            DataInicio: new Date("2026-01-01"),
            DataAlteracao: new Date("2026-03-10T13:00:00Z"),
            DataFim: new Date("2026-12-31"),
        };

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
        } as any);
        vi.mocked(s4DotzClient.contasContabeis.update).mockResolvedValue(contaAtualizada as any);

        const service = new ContasContabeisUpdateService();
        const result = await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            data: { glAccountName: "Nome Atualizado" },
        });

        expect(result).toMatchObject({
            chartOfAccounts: "PLAN",
            glAccountName: "Nome Atualizado",
        });
        expect(s4DotzClient.contasContabeis.update).toHaveBeenCalledWith({
            where: compositeWhere,
            data: expect.objectContaining({
                GLAccountName: "Nome Atualizado",
                DataAlteracao: expect.any(Date),
            }),
        });
    });

    it("deve limpar campos opcionais quando enviado null", async () => {
        const contaAtualizada = {
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
            GLAccountName: "Nome",
            GLAccountECD: null,
            GLAccountCosif: null,
            GLContaPaiCosif: null,
            ItemFluxoDeCaixa: "001",
            DataInicio: null,
            DataAlteracao: new Date("2026-03-10T13:00:00Z"),
            DataFim: null,
        };

        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
            GLAccountECD: "ECD",
            GLAccountCosif: "COSIF",
        } as any);
        vi.mocked(s4DotzClient.contasContabeis.update).mockResolvedValue(contaAtualizada as any);

        const service = new ContasContabeisUpdateService();
        await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
            data: {
                glAccountECD: null,
                glAccountCosif: null,
                glContaPaiCosif: null,
                dataInicio: null,
                dataFim: null,
            },
        });

        expect(s4DotzClient.contasContabeis.update).toHaveBeenCalledWith({
            where: compositeWhere,
            data: expect.objectContaining({
                GLAccountECD: null,
                GLAccountCosif: null,
                GLContaPaiCosif: null,
                DataInicio: null,
                DataFim: null,
                DataAlteracao: expect.any(Date),
            }),
        });
    });
});

describe("ContasContabeisDeleteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue(null);

        const service = new ContasContabeisDeleteService();
        const promise = service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "999",
        });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta contábil não encontrada",
            statusCode: 404,
        });
    });

    it("deve remover conta com sucesso", async () => {
        vi.mocked(s4DotzClient.contasContabeis.findUnique).mockResolvedValue({
            ChartOfAccounts: "PLAN",
            CompanyCode: "1000",
            GLAccount: "1.1.01.001",
        } as any);
        vi.mocked(s4DotzClient.contasContabeis.delete).mockResolvedValue({} as any);

        const service = new ContasContabeisDeleteService();
        const result = await service.execute({
            chartOfAccounts: "PLAN",
            companyCode: "1000",
            glAccount: "1.1.01.001",
        });

        expect(result).toEqual({
            message: "Conta contábil removida com sucesso",
        });
        expect(s4DotzClient.contasContabeis.delete).toHaveBeenCalledWith({
            where: compositeWhere,
        });
    });
});
