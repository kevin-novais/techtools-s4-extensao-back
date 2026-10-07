/*
    DTZ-273 - Conta contabil de receita/despesa a partir do documento de origem.

    fn_RetornaContraPartida so enxerga linhas do MESMO documento e escolhe a de
    maior valor absoluto no lado oposto. Em documentos de pagamento nao existe
    linha de resultado, entao ela cai na conta bancaria ou na conta de parceiro.

    Esta funcao mantem o mesmo contrato de retorno e resolve em camadas:

      nivel 0  proprio documento, lado oposto, PREFERINDO conta de resultado
      nivel 1..3  documentos ligados pelo grafo de compensacao (clearing) e de
                  estorno, percorrido nos dois sentidos, pegando o documento
                  mais proximo que possua linha de resultado
      nivel 9  fallback: exatamente o que fn_RetornaContraPartida devolve hoje

    Conta de resultado vem de profit_loss_account_type do S/4, nao da faixa da conta.
*/
CREATE OR ALTER FUNCTION dbo.fn_RetornaContaOrigem
(
    @Company_Code      varchar(4),
    @AccountingDocument nvarchar(10),
    @Fiscal_Year       nvarchar(4),
    @Posting_key       nvarchar(2),
    @debit_credit_code nvarchar(1)
)
RETURNS TABLE
AS
RETURN
(
    with contas_resultado as (
        -- classificacao vem do S/4 (profit_loss_account_type = 'X'), por maioria.
        -- A faixa da conta nao serve: a 22510111 (Outras receitas operacionais) e conta
        -- de resultado na faixa 2x e as 39919xxx (offsetting de imposto) sao
        -- patrimoniais na faixa 3x.
        select company_code, gl_account
        from s4_extensao_dotz.dbo.registros_contabeis
        group by company_code, gl_account
        having sum(case when profit_loss_account_type = 'X' then 1 else 0 end)
             > sum(case when isnull(profit_loss_account_type, '') <> 'X' then 1 else 0 end)
    ),
    arestas as (
        select distinct
               rc.company_code,
               rc.fiscal_year                   as a_ano,
               rc.accounting_document           as a_doc,
               rc.clearing_doc_fiscal_year      as b_ano,
               rc.clearing_accounting_document  as b_doc
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.company_code = @Company_Code
          and rc.clearing_accounting_document is not null
          and rc.clearing_accounting_document not in ('', '0')
          and rc.clearing_accounting_document <> rc.accounting_document
        union
        select distinct
               rc.company_code,
               rc.fiscal_year                      as a_ano,
               rc.accounting_document              as a_doc,
               rc.reverse_document_fiscal_year     as b_ano,
               rc.reverse_document                 as b_doc
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.company_code = @Company_Code
          and rc.reverse_document is not null
          and rc.reverse_document not in ('', '0')
          and rc.reverse_document <> rc.accounting_document
        union
        -- sticky_*: copia congelada pelo proprio sync, nunca sobrescrita por vazio.
        -- E a fonte mais completa, porque nao depende de envio nem de classificacao
        select distinct
               rc.company_code,
               rc.fiscal_year                     as a_ano,
               rc.accounting_document             as a_doc,
               -- o ano da compensacao nem sempre vem do S/4; o documento de origem
               -- praticamente sempre esta no mesmo exercicio da linha
               isnull(nullif(rc.sticky_clear_doc_fiscal_year, '0'), rc.fiscal_year) as b_ano,
               rc.sticky_clear_acc_doc            as b_doc
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.company_code = @Company_Code
          and rc.sticky_clear_acc_doc is not null
          and rc.sticky_clear_acc_doc not in ('', '0')
          and rc.sticky_clear_acc_doc <> rc.accounting_document
        union
        -- o SAP limpa clearing_*/reverse_* na reversao; as colunas sav_* congelam
        -- o vinculo no momento do envio e as vezes sao a unica copia que sobrou
        select distinct
               rc.company_code,
               rc.fiscal_year                  as a_ano,
               rc.accounting_document          as a_doc,
               rc.sav_clear_doc_fiscal_year    as b_ano,
               rc.sav_clear_acc_doc            as b_doc
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.company_code = @Company_Code
          and rc.sav_clear_acc_doc is not null
          and rc.sav_clear_acc_doc not in ('', '0')
          and rc.sav_clear_acc_doc <> rc.accounting_document
        union
        select distinct
               rc.company_code,
               rc.fiscal_year                  as a_ano,
               rc.accounting_document          as a_doc,
               rc.sav_rev_doc_fiscal_year      as b_ano,
               rc.sav_rev_doc                  as b_doc
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.company_code = @Company_Code
          and rc.sav_rev_doc is not null
          and rc.sav_rev_doc not in ('', '0')
          and rc.sav_rev_doc <> rc.accounting_document
    ),
    grafo as (
        select company_code, a_ano, a_doc, b_ano, b_doc from arestas
        union
        select company_code, b_ano, b_doc, a_ano, a_doc from arestas
    ),
    caminho as (
        select @Fiscal_Year as ano, @AccountingDocument as doc, 0 as nivel
        union all
        select g.b_ano, g.b_doc, c.nivel + 1
        from caminho c
        join grafo g
          on g.company_code = @Company_Code
         and g.a_ano = c.ano
         and g.a_doc = c.doc
        where c.nivel < 3
          and g.b_doc <> @AccountingDocument
    ),
    candidatas as (
        -- nivel 0: proprio documento, respeitando as mesmas restricoes da funcao
        -- original, porem restrito a contas de resultado
        select 0 as nivel,
               rc.gl_account,
               sum(abs(rc.Amount_in_company_code_currency)) as Total_Amount
        from s4_extensao_dotz.dbo.registros_contabeis rc
        where rc.Company_Code        = @Company_Code
          and rc.accounting_document = @AccountingDocument
          and rc.Fiscal_Year         = @Fiscal_Year
          and rc.Posting_key        <> @Posting_key
          and rc.Debit_credit_code  <> @debit_credit_code
          and (rc.withholding_tax_code is null or rc.withholding_tax_code in ('XX','01'))
          and exists (select 1 from contas_resultado cr
                       where cr.company_code = rc.company_code and cr.gl_account = rc.gl_account)
        group by rc.gl_account

        union all

        -- niveis 1..3: documentos alcancados pelo grafo de compensacao/estorno.
        -- aqui nao ha lado oposto a respeitar, o documento de origem inteiro e
        -- a contrapartida do pagamento
        select min(c.nivel) as nivel,
               o.gl_account,
               sum(abs(o.Amount_in_company_code_currency)) as Total_Amount
        from caminho c
        join s4_extensao_dotz.dbo.registros_contabeis o
          on o.Company_Code        = @Company_Code
         and o.Fiscal_Year         = c.ano
         and o.accounting_document = c.doc
        where c.nivel > 0
          and (o.withholding_tax_code is null or o.withholding_tax_code in ('XX','01'))
          and exists (select 1 from contas_resultado cr
                       where cr.company_code = o.company_code and cr.gl_account = o.gl_account)
        group by o.gl_account

        union all

        -- nivel 9: fallback, preserva o comportamento atual
        select 9 as nivel, fnc.gl_account, 0 as Total_Amount
        from dbo.fn_RetornaContraPartida(@Company_Code, @AccountingDocument, @Fiscal_Year, @Posting_key, @debit_credit_code) fnc
    )
    select top 1
           cand.gl_account,
           cc.gl_account_name,
           cc.item_fluxo_de_caixa
    from candidatas cand
    left join s4_extensao_dotz.dbo.contas_contabeis cc
           on cc.Company_code       = @Company_Code
          and cc.chart_of_accounts  = 'YCOA'
          and cc.gl_account         = cand.gl_account
    order by cand.nivel asc, cand.Total_Amount desc
);
