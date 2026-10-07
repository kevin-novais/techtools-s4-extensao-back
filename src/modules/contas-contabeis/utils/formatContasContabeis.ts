import { ContasContabeis } from "@prisma/client-s4-dotz";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";

export const formatContasContabeis = (record: ContasContabeis) => ({
    chartOfAccounts: record.ChartOfAccounts,
    companyCode: record.CompanyCode,
    glAccount: record.GLAccount,
    glAccountName: record.GLAccountName,
    glAccountECD: record.GLAccountECD ?? null,
    glAccountCosif: record.GLAccountCosif ?? null,
    glContaPaiCosif: record.GLContaPaiCosif ?? null,
    itemFluxoDeCaixa: record.ItemFluxoDeCaixa,
    glAccountB1Xtpg: record.GlAccountB1Xtpg ?? null,
    xtpgAtivado: record.XtpgAtivado,
    centroCusto: record.CentroCusto ?? null,
    centroLucro: record.CentroLucro ?? null,
    dataInicio: record.DataInicio == null ? null : formatDateOnly(record.DataInicio),
    dataAlteracao: record.DataAlteracao == null ? null : formatDateToBrazilianTimezone(record.DataAlteracao),
    dataFim: record.DataFim == null ? null : formatDateOnly(record.DataFim),
});
