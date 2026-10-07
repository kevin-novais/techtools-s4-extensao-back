import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasBancarias } from "@/modules/contas-bancarias/utils/formatContasBancarias";

export class ContasBancariasShowService {
    async execute(codigoCia: string, houseBank: string, houseBankAccount: string) {
        const conta = await s4DotzClient.contasBancarias.findUnique({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: codigoCia, HouseBank: houseBank, HouseBankAccount: houseBankAccount } },
        });

        if (!conta) throw new AppError("Conta bancária não encontrada", 404);

        return formatContasBancarias(conta);
    }
}
