/**
 * (DTZ-273) Resolve a conta de resultado de origem das linhas de parceiro e grava em
 * registros_contabeis.xtpg_conta_origem, para que a view XRT_SendFlux leia uma coluna
 * em vez de recorrer o grafo de compensacao por linha.
 *
 * A mesma regra existe em dbo.fn_RetornaContaOrigem, mantida como referencia para
 * conferencia linha a linha. A funcao custa 5,4s para 630 linhas porque o CROSS APPLY da
 * view a executa por linha e ela reconstroi o grafo a cada chamada; este statement monta
 * o grafo uma vez e resolve tudo de uma vez, em ~0,9s para a base inteira da HML.
 *
 * Roda como SQL inline e nao como procedure porque o usuario da aplicacao nao tem
 * permissao de EXECUTE no banco compartilhado (mesmo motivo de limparFilhosRevertidos).
 *
 * Nivel gravado em xtpg_conta_origem_nivel: 0 = proprio documento; 1..3 = saltos no grafo.
 * Conta de resultado vem de profit_loss_account_type do S/4, nao da faixa da conta.
 */
export const SQL_RESOLVE_CONTA_ORIGEM_XTPG = `
with contas_resultado as (
    -- classificacao vem do S/4: profit_loss_account_type = 'X' marca conta de resultado.
    -- Por maioria, porque algumas linhas chegam com o campo vazio: a 22510111 (Outras
    -- receitas operacionais) tem 53 marcadas contra 4 sem marca, e a 22510055 (banco)
    -- tem 1 contra 15. A faixa da conta NAO serve como criterio - a 22510111 e conta de
    -- resultado na faixa 2x, e as 39919xxx (offsetting de imposto) sao patrimoniais na 3x.
    select company_code, gl_account
    from dbo.registros_contabeis
    group by company_code, gl_account
    having sum(case when profit_loss_account_type = 'X' then 1 else 0 end)
         > sum(case when isnull(profit_loss_account_type, '') <> 'X' then 1 else 0 end)
),
arestas as (
    select distinct company_code,
           fiscal_year         as a_ano,
           accounting_document as a_doc,
           isnull(nullif(clearing_doc_fiscal_year, '0'), fiscal_year) as b_ano,
           clearing_accounting_document as b_doc
    from dbo.registros_contabeis
    where clearing_accounting_document is not null
      and clearing_accounting_document not in ('', '0')
      and clearing_accounting_document <> accounting_document
    union
    select distinct company_code, fiscal_year, accounting_document,
           isnull(nullif(sticky_clear_doc_fiscal_year, '0'), fiscal_year),
           sticky_clear_acc_doc
    from dbo.registros_contabeis
    where sticky_clear_acc_doc is not null
      and sticky_clear_acc_doc not in ('', '0')
      and sticky_clear_acc_doc <> accounting_document
    union
    select distinct company_code, fiscal_year, accounting_document,
           isnull(nullif(reverse_document_fiscal_year, '0'), fiscal_year),
           reverse_document
    from dbo.registros_contabeis
    where reverse_document is not null
      and reverse_document not in ('', '0')
      and reverse_document <> accounting_document
    union
    select distinct company_code, fiscal_year, accounting_document,
           isnull(nullif(sav_clear_doc_fiscal_year, '0'), fiscal_year),
           sav_clear_acc_doc
    from dbo.registros_contabeis
    where sav_clear_acc_doc is not null
      and sav_clear_acc_doc not in ('', '0')
      and sav_clear_acc_doc <> accounting_document
),
grafo as (
    select company_code, a_ano, a_doc, b_ano, b_doc from arestas
    union
    select company_code, b_ano, b_doc, a_ano, a_doc from arestas
),
alvo as (
    select distinct company_code, fiscal_year, accounting_document
    from dbo.registros_contabeis
    where financial_account_type in ('K', 'D')
),
caminho as (
    select company_code, fiscal_year as raiz_ano, accounting_document as raiz_doc,
           fiscal_year as ano, accounting_document as doc, 0 as nivel
    from alvo
    union all
    select c.company_code, c.raiz_ano, c.raiz_doc, g.b_ano, g.b_doc, c.nivel + 1
    from caminho c
    join grafo g on g.company_code = c.company_code
                and g.a_ano = c.ano
                and g.a_doc = c.doc
    where c.nivel < 3
      and g.b_doc <> c.raiz_doc
),
origem_por_doc as (
    select company_code, raiz_ano, raiz_doc, gl_account, nivel,
           row_number() over (partition by company_code, raiz_ano, raiz_doc
                              order by nivel asc, total desc) as ordem
    from (
        select c.company_code, c.raiz_ano, c.raiz_doc, o.gl_account,
               min(c.nivel) as nivel,
               sum(abs(o.amount_in_company_code_currency)) as total
        from caminho c
        join dbo.registros_contabeis o
          on o.company_code = c.company_code
         and o.fiscal_year = c.ano
         and o.accounting_document = c.doc
        where c.nivel > 0
          and (o.withholding_tax_code is null or o.withholding_tax_code in ('XX','01'))
          and exists (select 1 from contas_resultado cr
                       where cr.company_code = o.company_code and cr.gl_account = o.gl_account)
        group by c.company_code, c.raiz_ano, c.raiz_doc, o.gl_account
    ) t
),
origem_proprio_doc as (
    select company_code, fiscal_year, accounting_document, accounting_document_item,
           gl_account, ordem
    from (
        select rc.company_code, rc.fiscal_year, rc.accounting_document, rc.accounting_document_item,
               op.gl_account,
               row_number() over (partition by rc.company_code, rc.fiscal_year,
                                               rc.accounting_document, rc.accounting_document_item
                                  order by op.total desc) as ordem
        from dbo.registros_contabeis rc
        cross apply (
            select o.gl_account, sum(abs(o.amount_in_company_code_currency)) as total
            from dbo.registros_contabeis o
            where o.company_code = rc.company_code
              and o.fiscal_year = rc.fiscal_year
              and o.accounting_document = rc.accounting_document
              and o.posting_key <> rc.posting_key
              and o.debit_credit_code <> rc.debit_credit_code
              and (o.withholding_tax_code is null or o.withholding_tax_code in ('XX','01'))
              and exists (select 1 from contas_resultado cr
                           where cr.company_code = o.company_code and cr.gl_account = o.gl_account)
            group by o.gl_account
        ) op
        where rc.financial_account_type in ('K', 'D')
    ) t
)
update rc
   set rc.xtpg_conta_origem       = coalesce(p.gl_account, d.gl_account),
       rc.xtpg_conta_origem_nivel = case when p.gl_account is not null then 0 else d.nivel end,
       rc.xtpg_conta_origem_nome  = cc.gl_account_name
  from dbo.registros_contabeis rc
  left join origem_proprio_doc p
         on p.company_code = rc.company_code
        and p.fiscal_year = rc.fiscal_year
        and p.accounting_document = rc.accounting_document
        and p.accounting_document_item = rc.accounting_document_item
        and p.ordem = 1
  left join origem_por_doc d
         on d.company_code = rc.company_code
        and d.raiz_ano = rc.fiscal_year
        and d.raiz_doc = rc.accounting_document
        and d.ordem = 1
  left join dbo.contas_contabeis cc
         on cc.company_code = rc.company_code
        and cc.chart_of_accounts = 'YCOA'
        and cc.gl_account = coalesce(p.gl_account, d.gl_account)
 where rc.financial_account_type in ('K', 'D')
   and (p.gl_account is not null or d.gl_account is not null)
`;
