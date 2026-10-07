import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatContasContabeis } from "@/modules/contas-contabeis/utils/formatContasContabeis";
import { parseDateAsBrazilian } from "@/util/date";

interface ContasContabeisUpdatePayload {
    glAccountName?: string | null;
    glAccountECD?: string | null;
    glAccountCosif?: string | null;
    glContaPaiCosif?: string | null;
    itemFluxoDeCaixa?: string | null;
    glAccountB1Xtpg?: string | null;
    xtpgAtivado?: boolean | null;
    centroCusto?: string | null;
    centroLucro?: string | null;
    dataInicio?: string | null;
    dataFim?: string | null;
}

interface ContasContabeisUpdateParams {
    chartOfAccounts: string;
    companyCode: string;
    glAccount: string;
    data: ContasContabeisUpdatePayload;
}

export class ContasContabeisUpdateService {
    async execute({ chartOfAccounts, companyCode, glAccount, data }: ContasContabeisUpdateParams) {
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

        const now = new Date();

        const updateData: Record<string, unknown> = {
            DataAlteracao: now,
            ...(data.glAccountName === undefined ? {} : { GLAccountName: data.glAccountName }),
            ...(data.glAccountECD === undefined ? {} : { GLAccountECD: data.glAccountECD }),
            ...(data.glAccountCosif === undefined ? {} : { GLAccountCosif: data.glAccountCosif }),
            ...(data.glContaPaiCosif === undefined ? {} : { GLContaPaiCosif: data.glContaPaiCosif }),
            ...(data.itemFluxoDeCaixa === undefined ? {} : { ItemFluxoDeCaixa: data.itemFluxoDeCaixa }),
            ...(data.glAccountB1Xtpg === undefined ? {} : { GlAccountB1Xtpg: data.glAccountB1Xtpg }),
            ...(data.xtpgAtivado === undefined ? {} : { XtpgAtivado: data.xtpgAtivado }),
            ...(data.centroCusto === undefined ? {} : { CentroCusto: data.centroCusto }),
            ...(data.centroLucro === undefined ? {} : { CentroLucro: data.centroLucro }),
            ...(data.dataInicio === undefined
                ? {}
                : { DataInicio: data.dataInicio == null ? null : parseDateAsBrazilian(data.dataInicio) }),
            ...(data.dataFim === undefined
                ? {}
                : { DataFim: data.dataFim == null ? null : parseDateAsBrazilian(data.dataFim) }),
        };

        const contaAtualizada = await s4DotzClient.contasContabeis.update({
            where: {
                ChartOfAccounts_CompanyCode_GLAccount: {
                    ChartOfAccounts: chartOfAccounts,
                    CompanyCode: companyCode,
                    GLAccount: glAccount,
                },
            },
            data: updateData,
        });

        return formatContasContabeis(contaAtualizada);
    }
}
