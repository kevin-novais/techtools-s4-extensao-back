import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasBancarias } from "@/modules/contas-bancarias/utils/formatContasBancarias";

interface ContasBancariasCreatePayload {
    codigoCia: string;
    houseBank: string;
    houseBankAccount: string;
    numeroBanco: string;
    numeroAgencia: string;
    nomeBanco: string;
    digitoAgenca?: string;
    numeroConta: string;
    digitoConta?: string;
    glAccount?: string;
    numeroBancoLegado?: string;
    numeroAgenciaLegado?: string;
    digitoAgenciaLegado?: string;
    numeroContaLegado?: string;
    digitoContaLegado?: string;
}

export class ContasBancariasCreateService {
    async execute(data: ContasBancariasCreatePayload) {
        const existente = await s4DotzClient.contasBancarias.findUnique({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: data.codigoCia, HouseBank: data.houseBank, HouseBankAccount: data.houseBankAccount } },
        });
        if (existente) throw new AppError("Já existe uma conta bancária com esta combinação de Cia, House Bank e House Bank Account", 400);

        const conta = await s4DotzClient.contasBancarias.create({
            data: {
                CodigoCia: data.codigoCia,
                HouseBank: data.houseBank,
                HouseBankAccount: data.houseBankAccount,
                NumeroBanco: data.numeroBanco,
                NumeroAgencia: data.numeroAgencia,
                NomeBanco: data.nomeBanco,
                ...(data.digitoAgenca ? { DigitoAgenca: data.digitoAgenca } : {}),
                NumeroConta: data.numeroConta,
                ...(data.digitoConta ? { DigitoConta: data.digitoConta } : {}),
                ...(data.glAccount ? { GLAccount: data.glAccount } : {}),
                ...(data.numeroBancoLegado ? { NumeroBancoLegado: data.numeroBancoLegado } : {}),
                ...(data.numeroAgenciaLegado ? { NumeroAgenciaLegado: data.numeroAgenciaLegado } : {}),
                ...(data.digitoAgenciaLegado ? { DigitoAgenciaLegado: data.digitoAgenciaLegado } : {}),
                ...(data.numeroContaLegado ? { NumeroContaLegado: data.numeroContaLegado } : {}),
                ...(data.digitoContaLegado ? { DigitoContaLegado: data.digitoContaLegado } : {}),
            },
        });

        return formatContasBancarias(conta);
    }
}
