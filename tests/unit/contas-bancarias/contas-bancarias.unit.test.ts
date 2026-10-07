import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContasBancariasCreateService } from "../../../src/modules/contas-bancarias/services/ContasBancariasCreateService";
import { ContasBancariasListService } from "../../../src/modules/contas-bancarias/services/ContasBancariasListService";
import { ContasBancariasShowService } from "../../../src/modules/contas-bancarias/services/ContasBancariasShowService";
import { ContasBancariasUpdateService } from "../../../src/modules/contas-bancarias/services/ContasBancariasUpdateService";
import { ContasBancariasDeleteService } from "../../../src/modules/contas-bancarias/services/ContasBancariasDeleteService";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        contasBancarias: {
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
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

const compositeKeyWhere = {
    CodigoCia_HouseBank_HouseBankAccount: {
        CodigoCia: "1000",
        HouseBank: "B001",
        HouseBankAccount: "ACC001",
    },
};

const basePayload = {
    codigoCia: "1000",
    houseBank: "B001",
    houseBankAccount: "ACC001",
    numeroBanco: "001",
    numeroAgencia: "1234",
    nomeBanco: "Banco Teste",
    numeroConta: "12345",
    digitoConta: "1",
    glAccount: "1.1.01.001",
};

describe("ContasBancariasCreateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 400 quando conta já existe", async () => {
        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue({
            CodigoCia: "1000",
            HouseBank: "B001",
            HouseBankAccount: "ACC001",
        } as any);

        const service = new ContasBancariasCreateService();
        const promise = service.execute(basePayload);

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Já existe uma conta bancária com esta combinação de Cia, House Bank e House Bank Account",
            statusCode: 400,
        });
    });

    it("deve criar conta com sucesso e retornar objeto formatado", async () => {
        const contaCriada = {
            CodigoCia: "1000",
            HouseBank: "B001",
            HouseBankAccount: "ACC001",
            NumeroBanco: "001",
            NumeroAgencia: "1234",
            NomeBanco: "Banco Teste",
            DigitoAgenca: "0",
            NumeroConta: "12345",
            DigitoConta: "1",
            GLAccount: "1.1.01.001",
            criadoEm: new Date("2026-03-12T10:00:00Z"),
            atualizadoEm: new Date("2026-03-12T10:00:00Z"),
        };

        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasBancarias.create).mockResolvedValue(contaCriada as any);

        const service = new ContasBancariasCreateService();
        const result = await service.execute({ ...basePayload, digitoAgenca: "0" });

        expect(result).toMatchObject({
            codigoCia: "1000",
            houseBank: "B001",
            houseBankAccount: "ACC001",
            numeroBanco: "001",
            nomeBanco: "Banco Teste",
        });
        expect(s4DotzClient.contasBancarias.create).toHaveBeenCalledOnce();
    });

    it("deve criar conta com digitoAgenca omitido", async () => {
        const contaCriada = {
            CodigoCia: "1000",
            HouseBank: "B001",
            HouseBankAccount: "ACC001",
            NumeroBanco: "001",
            NumeroAgencia: "1234",
            NomeBanco: "Banco Teste",
            DigitoAgenca: null,
            NumeroConta: "12345",
            DigitoConta: "1",
            GLAccount: "1.1.01.001",
            criadoEm: new Date("2026-03-12T10:00:00Z"),
            atualizadoEm: new Date("2026-03-12T10:00:00Z"),
        };

        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(null);
        vi.mocked(s4DotzClient.contasBancarias.create).mockResolvedValue(contaCriada as any);

        const service = new ContasBancariasCreateService();
        const result = await service.execute(basePayload);

        expect(result).toMatchObject({
            codigoCia: "1000",
            houseBank: "B001",
            houseBankAccount: "ACC001",
            digitoAgenca: null,
        });
        expect(s4DotzClient.contasBancarias.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                CodigoCia: "1000",
                HouseBank: "B001",
                HouseBankAccount: "ACC001",
                NumeroBanco: "001",
                NumeroAgencia: "1234",
                NomeBanco: "Banco Teste",
                NumeroConta: "12345",
                DigitoConta: "1",
                GLAccount: "1.1.01.001",
            }),
        });
        expect(s4DotzClient.contasBancarias.create).toHaveBeenCalledOnce();
    });
});

describe("ContasBancariasListService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve retornar lista com paginação correta", async () => {
        const contas = [
            {
                CodigoCia: "1000",
                HouseBank: "B001",
                HouseBankAccount: "ACC001",
                NumeroBanco: "001",
                NumeroAgencia: "1234",
                NomeBanco: "Banco 1",
                DigitoAgenca: "0",
                NumeroConta: "12345",
                DigitoConta: "1",
                GLAccount: "1.1.01.001",
                criadoEm: new Date("2026-03-12T10:00:00Z"),
                atualizadoEm: new Date("2026-03-12T10:00:00Z"),
            },
            {
                CodigoCia: "1000",
                HouseBank: "B002",
                HouseBankAccount: "ACC002",
                NumeroBanco: "002",
                NumeroAgencia: "5678",
                NomeBanco: "Banco 2",
                DigitoAgenca: null,
                NumeroConta: "67890",
                DigitoConta: "2",
                GLAccount: "1.1.01.002",
                criadoEm: new Date("2026-03-12T10:00:00Z"),
                atualizadoEm: new Date("2026-03-12T10:00:00Z"),
            },
        ];

        vi.mocked(s4DotzClient.contasBancarias.count).mockResolvedValue(5);
        vi.mocked(s4DotzClient.contasBancarias.findMany).mockResolvedValue(contas as any);

        const service = new ContasBancariasListService();
        const result = await service.execute({ page: 1, limit: 2 });

        expect(result.contasBancarias).toHaveLength(2);
        expect(result.pagination).toMatchObject({
            currentPage: 1,
            totalItems: 5,
            totalPages: 3,
            itemsPerPage: 2,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });
});

describe("ContasBancariasShowService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(null);

        const service = new ContasBancariasShowService();
        const promise = service.execute("9999", "B001", "ACC001");

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta bancária não encontrada",
            statusCode: 404,
        });
    });

    it("deve retornar conta formatada quando encontrada", async () => {
        const conta = {
            CodigoCia: "1000",
            HouseBank: "B001",
            HouseBankAccount: "ACC001",
            NumeroBanco: "001",
            NumeroAgencia: "1234",
            NomeBanco: "Banco Teste",
            DigitoAgenca: "0",
            NumeroConta: "12345",
            DigitoConta: "1",
            GLAccount: "1.1.01.001",
            criadoEm: new Date("2026-03-12T10:00:00Z"),
            atualizadoEm: new Date("2026-03-12T10:00:00Z"),
        };

        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(conta as any);

        const service = new ContasBancariasShowService();
        const result = await service.execute("1000", "B001", "ACC001");

        expect(result).toMatchObject({
            codigoCia: "1000",
            houseBank: "B001",
            houseBankAccount: "ACC001",
            nomeBanco: "Banco Teste",
        });
    });
});

describe("ContasBancariasUpdateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(null);

        const service = new ContasBancariasUpdateService();
        const promise = service.execute("9999", "B001", "ACC001", { nomeBanco: "Novo Nome" });

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta bancária não encontrada",
            statusCode: 404,
        });
    });

    it("deve atualizar conta com sucesso", async () => {
        const contaAtualizada = {
            CodigoCia: "1000",
            HouseBank: "B001",
            HouseBankAccount: "ACC001",
            NumeroBanco: "001",
            NumeroAgencia: "1234",
            NomeBanco: "Nome Atualizado",
            DigitoAgenca: "0",
            NumeroConta: "12345",
            DigitoConta: "1",
            GLAccount: "1.1.01.001",
            criadoEm: new Date("2026-03-12T10:00:00Z"),
            atualizadoEm: new Date("2026-03-12T13:00:00Z"),
        };

        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue({
            CodigoCia: "1000",
        } as any);
        vi.mocked(s4DotzClient.contasBancarias.update).mockResolvedValue(contaAtualizada as any);

        const service = new ContasBancariasUpdateService();
        const result = await service.execute("1000", "B001", "ACC001", { nomeBanco: "Nome Atualizado" });

        expect(result).toMatchObject({
            codigoCia: "1000",
            houseBank: "B001",
            nomeBanco: "Nome Atualizado",
        });
        expect(s4DotzClient.contasBancarias.update).toHaveBeenCalledWith({
            where: compositeKeyWhere,
            data: expect.objectContaining({
                NomeBanco: "Nome Atualizado",
                atualizadoEm: expect.any(Date),
            }),
        });
    });
});

describe("ContasBancariasDeleteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando conta não encontrada", async () => {
        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue(null);

        const service = new ContasBancariasDeleteService();
        const promise = service.execute("9999", "B001", "ACC001");

        await expect(promise).rejects.toThrow(AppError);
        await expect(promise).rejects.toMatchObject({
            message: "Conta bancária não encontrada",
            statusCode: 404,
        });
    });

    it("deve remover conta com sucesso", async () => {
        vi.mocked(s4DotzClient.contasBancarias.findUnique).mockResolvedValue({
            CodigoCia: "1000",
        } as any);
        vi.mocked(s4DotzClient.contasBancarias.delete).mockResolvedValue({} as any);

        const service = new ContasBancariasDeleteService();
        const result = await service.execute("1000", "B001", "ACC001");

        expect(result).toEqual({
            message: "Conta bancária removida com sucesso",
        });
        expect(s4DotzClient.contasBancarias.delete).toHaveBeenCalledWith({
            where: compositeKeyWhere,
        });
    });
});
