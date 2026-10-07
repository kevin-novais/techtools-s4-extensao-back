/*
    DIAGNOSTICO - cancelamento saindo sem sinal negativo (relato Marco Leite, 24/07)

    Chaves relatadas (OrigemPk = XRT_SendFlux.Chave_da_transacao):
        0101-2026-1400000045-2-1400000038   Valor 6297.66    SUCESSO_FLUX
        0101-2026-1500000086-2-1500000084   Valor 22695.49   SUCESSO_FLUX

    Formato da chave: empresa-ano-documento-item-<doc referenciado>
    O 5o segmento muda de ramo para ramo da view:
        ramo 1  'Pagto Prev Rever'      -> sav_clear_acc_doc          Liq = ... *-1        (SEMPRE inverte)
        ramo 10 'Pagto Previsto'        -> clearing_accounting_document Liq = K? *-1 : +   (so inverte K)
        ramo 20 'Pagto Prev Bank Plus'  -> clearing_accounting_document Liq = K? *-1 : +   (so inverte K)
        ramo 30 'LCM'                   -> (sem 5o segmento)          Liq = amount         (nao inverte)
        ramo 40 'Pagto Estorno CP'      -> reverse_document           Liq = K? *-1 : +     (so inverte K)

    Hipotese a confirmar: o cancelamento sai pelo ramo 40 (ou 10/20), onde a regra de
    sinal so inverte 'K'. Como a linha de estorno ja nasce no S/4 com o sinal oposto ao
    do lancamento original, o resultado e:
        - se D  -> nao inverte nada, sai igual ao original
        - se K  -> inverte de novo, desfaz a inversao e sai igual ao original
    Nos dois casos o XTPG recebe o cancelamento com o MESMO sinal do lancamento, entao
    nao ha compensacao.
*/

-- ---------------------------------------------------------------------------
-- 1) De qual ramo saiu cada chave, e com que Liq
-- ---------------------------------------------------------------------------
select v.BlocoSAP, v.ordem, v.Chave_da_transacao, v.Liq, v.CFWId,
       v.Conta_contabil, v.Descr_Conta_contabil, v.OBJ, v.Diario_original
from s4_extensao_dotz.dbo.XRT_SendFlux v
where v.Chave_da_transacao in ('0101-2026-1400000045-2-1400000038',
                               '0101-2026-1500000086-2-1500000084');

-- ---------------------------------------------------------------------------
-- 2) Linha bruta do documento de ESTORNO e do documento ORIGINAL
--    (sinal, tipo de conta, marcadores de reversao)
-- ---------------------------------------------------------------------------
select rc.accounting_document, rc.Accounting_document_item,
       rc.financial_account_type, rc.posting_key, rc.debit_credit_code,
       rc.amount_in_company_code_currency,
       rc.is_reversal, rc.is_cleared,
       rc.reverse_document, rc.reverse_document_fiscal_year,
       rc.clearing_accounting_document, rc.clearing_doc_fiscal_year, rc.clearing_item,
       rc.sav_clear_acc_doc, rc.sav_rev_doc,
       rc.sticky_clear_acc_doc, rc.sticky_clear_doc_fiscal_year,
       rc.item_fluxo_de_caixa, rc.xtpg_conta_origem, rc.xtpg_conta_origem_nivel,
       rc.status_para_envio, rc.gl_account, rc.accounting_document_type
from s4_extensao_dotz.dbo.registros_contabeis rc
where rc.company_code = '0101'
  and rc.fiscal_year  = '2026'
  and rc.accounting_document in ('1400000045','1400000038','1500000086','1500000084')
order by rc.accounting_document, rc.Accounting_document_item;

-- ---------------------------------------------------------------------------
-- 3) O que ja foi enviado ao XTPG para o par (original x estorno):
--    se os dois sairam com o mesmo sinal, o cancelamento nao compensa
-- ---------------------------------------------------------------------------
select l.*
from s4_extensao_dotz.dbo.xtpg_envio_log l
where l.origem_pk like '0101-2026-14000000%'
   or l.origem_pk like '0101-2026-15000000%'
order by l.criado_em desc;

-- ---------------------------------------------------------------------------
-- 4) Dimensao do problema: quantos estornos ja foram enviados com sinal igual
--    ao do lancamento original
-- ---------------------------------------------------------------------------
select rev.company_code,
       rev.financial_account_type,
       count(*) as linhas_estorno_enviadas,
       sum(case when rev.amount_in_company_code_currency > 0 then 1 else 0 end) as amount_positivo,
       sum(case when rev.amount_in_company_code_currency < 0 then 1 else 0 end) as amount_negativo
from s4_extensao_dotz.dbo.registros_contabeis rev
where rev.is_reversal = 'X'
  and rev.financial_account_type in ('K','D')
  and rev.status_para_envio = 'SUCESSO_FLUX'
group by rev.company_code, rev.financial_account_type
order by rev.company_code, rev.financial_account_type;

-- ---------------------------------------------------------------------------
-- 5) Cancelamentos que NAO estao carregando: por que cada linha de estorno
--    pendente nao e capturada por nenhum ramo
-- ---------------------------------------------------------------------------
select rev.company_code, rev.fiscal_year, rev.accounting_document, rev.Accounting_document_item,
       rev.financial_account_type, rev.status_para_envio, rev.item_fluxo_de_caixa,
       rev.accounting_document_type,
       case
         when rev.status_para_envio is not null            then 'ja enviado (status ' + rev.status_para_envio + ')'
         when rev.item_fluxo_de_caixa is null
           or rev.item_fluxo_de_caixa in ('','0','999')    then 'BLOQUEADO PELO GATE (item de fluxo nao classificado)'
         when rev.clearing_accounting_document <> rev.accounting_document
                                                           then 'topologia nao colapsada (ramo 40 exige clearing = proprio doc)'
         when rev.reverse_document = rev.clearing_accounting_document
                                                           then 'reverse = clearing (ramo 40 exclui)'
         when not exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis orig
                           where orig.company_code = rev.company_code
                             and orig.accounting_document = rev.reverse_document
                             and orig.reverse_document = orig.clearing_accounting_document
                             and orig.reverse_document = rev.accounting_document)
                                                           then 'par original nao encontrado (exists do ramo 40)'
         else 'deveria estar saindo'
       end as motivo
from s4_extensao_dotz.dbo.registros_contabeis rev
where rev.is_reversal = 'X'
  and rev.financial_account_type in ('K','D')
order by rev.company_code, rev.accounting_document, rev.Accounting_document_item;
