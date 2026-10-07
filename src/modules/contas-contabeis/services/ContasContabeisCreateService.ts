import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasContabeis } from "@/modules/contas-contabeis/utils/formatContasContabeis";
import { parseDateAsBrazilian } from "@/util/date";

interface ContasContabeisCreatePayload {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
    glAccountName: string;
    glAccountECD?: string;
    glAccountCosif?: string;
    glContaPaiCosif?: string;
    itemFluxoDeCaixa: string;
    glAccountB1Xtpg?: string;
    xtpgAtivado?: boolean;
    centroCusto?: string;
    centroLucro?: string;
    dataInicio?: string;
    dataFim?: string;
}

export class ContasContabeisCreateService {
    async execute(data: ContasContabeisCreatePayload) {
        const existente = await s4DotzClient.contasContabeis.findUnique({
            where: {
                ChartOfAccounts_CompanyCode_GLAccount: {
                    ChartOfAccounts: data.chartOfAccounts,
                    CompanyCode: data.companyCode,
                    GLAccount: data.glAccount,
                },
            },
        });

        if (existente) {
            throw new AppError("Conta contábil já cadastrada para este plano de contas, empresa e conta", 400);
        }

        const conta = await s4DotzClient.contasContabeis.create({
            data: {
                ChartOfAccounts: data.chartOfAccounts,
                CompanyCode: data.companyCode,
                GLAccount: data.glAccount,
                GLAccountName: data.glAccountName,
                ...(data.glAccountECD != null && data.glAccountECD !== "" && { GLAccountECD: data.glAccountECD }),
                ...(data.glAccountCosif != null && data.glAccountCosif !== "" && { GLAccountCosif: data.glAccountCosif }),
                ...(data.glContaPaiCosif != null && data.glContaPaiCosif !== "" && { GLContaPaiCosif: data.glContaPaiCosif }),
                ItemFluxoDeCaixa: data.itemFluxoDeCaixa,
                ...(data.glAccountB1Xtpg != null &&
                    data.glAccountB1Xtpg !== "" && { GlAccountB1Xtpg: data.glAccountB1Xtpg }),
                XtpgAtivado: data.xtpgAtivado ?? false,
                ...(data.centroCusto != null && data.centroCusto !== "" && { CentroCusto: data.centroCusto }),
                ...(data.centroLucro != null && data.centroLucro !== "" && { CentroLucro: data.centroLucro }),
                ...(data.dataInicio != null && data.dataInicio !== "" && { DataInicio: parseDateAsBrazilian(data.dataInicio) }),
                ...(data.dataFim != null && data.dataFim !== "" && { DataFim: parseDateAsBrazilian(data.dataFim) }),
            },
        });

        return formatContasContabeis(conta);
    }
}
