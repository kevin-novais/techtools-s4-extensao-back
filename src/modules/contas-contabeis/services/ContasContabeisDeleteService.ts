import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

interface ContasContabeisDeleteParams {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
}

export class ContasContabeisDeleteService {
    async execute({ chartOfAccounts, companyCode, glAccount }: ContasContabeisDeleteParams) {
        const conta = await s4DotzClient.contasContabeis.findUnique({
            where: {
                ChartOfAccounts_CompanyCode_GLAccount: {
                    ChartOfAccounts: chartOfAccounts,
                    CompanyCode: companyCode,
                    GLAccount: glAccount,
                },
            },
        });

        if (!conta) {
            throw new AppError("Conta contábil não encontrada", 404);
        }

        await s4DotzClient.contasContabeis.delete({
            where: {
                ChartOfAccounts_CompanyCode_GLAccount: {
                    ChartOfAccounts: chartOfAccounts,
                    CompanyCode: companyCode,
                    GLAccount: glAccount,
                },
            },
        });

        return {
            message: "Conta contábil removida com sucesso",
        };
    }
}
