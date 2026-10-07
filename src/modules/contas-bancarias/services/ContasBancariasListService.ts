import { ContasBancarias } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateToBrazilianTimezone } from "@/util/date";
import {
    agGridFilterModelToPrismaWhere,
    agGridSortModelToPrismaOrderBy,
    mergePrismaWhere,
} from "@/util/filter";

interface ContasBancariasListParams {
    page?: number;
    limit?: number;
    filterModel?: string;
    sortModel?: string;
    codigoCia?: string;
    houseBank?: string;
    houseBankAccount?: string;
    nomeBanco?: string;
    numeroBanco?: string;
    glAccount?: string;
}

const FIELD_MAP: Record<string, string> = {
    codigoCia: "CodigoCia",
    houseBank: "HouseBank",
    houseBankAccount: "HouseBankAccount",
    numeroBanco: "NumeroBanco",
    numeroAgencia: "NumeroAgencia",
    nomeBanco: "NomeBanco",
    digitoAgenca: "DigitoAgenca",
    numeroConta: "NumeroConta",
    digitoConta: "DigitoConta",
    glAccount: "GLAccount",
    criadoEm: "criadoEm",
    atualizadoEm: "atualizadoEm",
};

export class ContasBancariasListService {
    async execute(params: ContasBancariasListParams = {}) {
        const {
            page = 1,
            limit = 10,
            filterModel,
            sortModel,
            codigoCia,
            houseBank,
            houseBankAccount,
            nomeBanco,
            numeroBanco,
            glAccount,
        } = params;

        const baseWhere: Record<string, unknown> = {
            ...(codigoCia ? { CodigoCia: { contains: codigoCia } } : {}),
            ...(houseBank ? { HouseBank: { contains: houseBank } } : {}),
            ...(houseBankAccount ? { HouseBankAccount: { contains: houseBankAccount } } : {}),
            ...(nomeBanco ? { NomeBanco: { contains: nomeBanco } } : {}),
            ...(numeroBanco ? { NumeroBanco: { contains: numeroBanco } } : {}),
            ...(glAccount ? { GLAccount: { contains: glAccount } } : {}),
        };

        const agGridWhere = agGridFilterModelToPrismaWhere(filterModel, {}, FIELD_MAP);
        const where = mergePrismaWhere(baseWhere, agGridWhere);
        const defaultOrderBy = [{ CodigoCia: "asc" as const }];
        const orderBy = agGridSortModelToPrismaOrderBy(sortModel, {}, FIELD_MAP, defaultOrderBy);

        const skip = (page - 1) * limit;

        const [totalItems, contasBancarias] = await Promise.all([
            s4DotzClient.contasBancarias.count({ where }),
            s4DotzClient.contasBancarias.findMany({ where, orderBy, skip, take: limit }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formatted = contasBancarias.map((item: ContasBancarias) => ({
            codigoCia: item.CodigoCia,
            houseBank: item.HouseBank,
            houseBankAccount: item.HouseBankAccount,
            numeroBanco: item.NumeroBanco,
            numeroAgencia: item.NumeroAgencia,
            nomeBanco: item.NomeBanco,
            digitoAgenca: item.DigitoAgenca ?? null,
            numeroConta: item.NumeroConta,
            digitoConta: item.DigitoConta,
            glAccount: item.GLAccount,
            numeroBancoLegado: item.NumeroBancoLegado ?? null,
            numeroAgenciaLegado: item.NumeroAgenciaLegado ?? null,
            digitoAgenciaLegado: item.DigitoAgenciaLegado ?? null,
            numeroContaLegado: item.NumeroContaLegado ?? null,
            digitoContaLegado: item.DigitoContaLegado ?? null,
            criadoEm: formatDateToBrazilianTimezone(item.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(item.atualizadoEm),
        }));

        return {
            contasBancarias: formatted,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}
