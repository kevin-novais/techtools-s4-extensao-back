import { applyReportVariables } from '@/modules/relatorio/utils/applyReportVariables';
import { RelatorioVariavelInput, ReportVariableValues } from '@/modules/relatorio/utils/relatorioVariableTypes';

export function resolveReportQuery(
    baseQuery: string,
    variaveis: RelatorioVariavelInput[],
    variables: ReportVariableValues = {},
) {
    if (variaveis.length === 0) {
        return { resolvedQuery: baseQuery, variableParams: [] as (string | number | Date)[] };
    }

    return applyReportVariables(baseQuery, variaveis, variables);
}
