import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasContabeis } from "@/modules/contas-contabeis/utils/formatContasContabeis";

interface ContasContabeisShowParams {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
}

export class ContasContabeisShowService {
    async execute({ chartOfAccounts, companyCode, glAccount }: ContasContabeisShowParams) {
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

        return formatContasContabeis(conta);
    }
}
