import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasBancarias } from "@/modules/contas-bancarias/utils/formatContasBancarias";

interface ContasBancariasUpdatePayload {
    numeroBanco?: string | null;
    numeroAgencia?: string | null;
    nomeBanco?: string | null;
    digitoAgenca?: string | null;
    numeroConta?: string | null;
    digitoConta?: string | null;
    glAccount?: string | null;
    numeroBancoLegado?: string | null;
    numeroAgenciaLegado?: string | null;
    digitoAgenciaLegado?: string | null;
    numeroContaLegado?: string | null;
    digitoContaLegado?: string | null;
}

export class ContasBancariasUpdateService {
    async execute(codigoCia: string, houseBank: string, houseBankAccount: string, data: ContasBancariasUpdatePayload) {
        const conta = await s4DotzClient.contasBancarias.findUnique({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: codigoCia, HouseBank: houseBank, HouseBankAccount: houseBankAccount } },
        });

        if (!conta) throw new AppError("Conta bancária não encontrada", 404);

        const updateData: Record<string, unknown> = {
            atualizadoEm: new Date(),
            ...(data.numeroBanco === undefined ? {} : { NumeroBanco: data.numeroBanco }),
            ...(data.numeroAgencia === undefined ? {} : { NumeroAgencia: data.numeroAgencia }),
            ...(data.nomeBanco === undefined ? {} : { NomeBanco: data.nomeBanco }),
            ...(data.digitoAgenca === undefined ? {} : { DigitoAgenca: data.digitoAgenca }),
            ...(data.numeroConta === undefined ? {} : { NumeroConta: data.numeroConta }),
            ...(data.digitoConta === undefined ? {} : { DigitoConta: data.digitoConta }),
            ...(data.glAccount === undefined ? {} : { GLAccount: data.glAccount }),
            ...(data.numeroBancoLegado === undefined ? {} : { NumeroBancoLegado: data.numeroBancoLegado }),
            ...(data.numeroAgenciaLegado === undefined ? {} : { NumeroAgenciaLegado: data.numeroAgenciaLegado }),
            ...(data.digitoAgenciaLegado === undefined ? {} : { DigitoAgenciaLegado: data.digitoAgenciaLegado }),
            ...(data.numeroContaLegado === undefined ? {} : { NumeroContaLegado: data.numeroContaLegado }),
            ...(data.digitoContaLegado === undefined ? {} : { DigitoContaLegado: data.digitoContaLegado }),
        };

        const contaAtualizada = await s4DotzClient.contasBancarias.update({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: codigoCia, HouseBank: houseBank, HouseBankAccount: houseBankAccount } },
            data: updateData,
        });

        return formatContasBancarias(contaAtualizada);
    }
}
