import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export class ContasBancariasDeleteService {
    async execute(codigoCia: string, houseBank: string, houseBankAccount: string) {
        const conta = await s4DotzClient.contasBancarias.findUnique({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: codigoCia, HouseBank: houseBank, HouseBankAccount: houseBankAccount } },
        });

        if (!conta) throw new AppError("Conta bancária não encontrada", 404);

        await s4DotzClient.contasBancarias.delete({
            where: { CodigoCia_HouseBank_HouseBankAccount: { CodigoCia: codigoCia, HouseBank: houseBank, HouseBankAccount: houseBankAccount } },
        });

        return { message: "Conta bancária removida com sucesso" };
    }
}
