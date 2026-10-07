/**
 * De-para de Conta Contábil (B1/XTPG -> S/4) para a Saída XTPG.
 *
 * As contas que vêm do XTPG são do plano do B1 (ex.: 1121002) e NÃO existem no
 * plano YCOA do S/4 (comprovado no teste: erro 507(F5) "G/L account ... is not
 * defined in chart of accounts YCOA"). A conversão usa a tabela `contas_contabeis`
 * (sincronizada do S/4), campo `gl_account_b1_xtpg` = conta B1 -> `gl_account` S/4.
 *
 * Sem correspondência => trava o PAR_CONTABIL (mesmo tratamento do de-para bancário).
 */
import s4DotzClient from "@/database/clients/s4DotzClient";

export interface DeParaContaS4 {
    /** gl_account do S/4. */
    glAccount: string;
    /** (DTZ-247) Centro de custo cadastrado na conta (para o LCM). */
    centroCusto: string | null;
    /** (DTZ-247) Centro de lucro cadastrado na conta (para o LCM). */
    centroLucro: string | null;
}

export class ContasContabeisDeParaRepository {
    /**
     * Resolve a conta S/4 (GLAccount) + centros de custo/lucro a partir da conta B1
     * do movimento.
     * @returns de-para do S/4 ou `null` se não houver correspondência.
     */
    async resolver(params: { companyCode: string; contaB1: string }): Promise<DeParaContaS4 | null> {
        if (!params.companyCode || !params.contaB1) return null;

        const conta = await s4DotzClient.contasContabeis.findFirst({
            where: {
                CompanyCode: params.companyCode,
                GlAccountB1Xtpg: params.contaB1,
            },
            select: { GLAccount: true, CentroCusto: true, CentroLucro: true },
        });

        if (!conta?.GLAccount) return null;
        return {
            glAccount: conta.GLAccount,
            centroCusto: conta.CentroCusto ?? null,
            centroLucro: conta.CentroLucro ?? null,
        };
    }
}
