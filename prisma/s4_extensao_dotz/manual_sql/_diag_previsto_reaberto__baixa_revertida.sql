/*
    Diagnostico: previsto reabre ZERADO ao cancelar a baixa (DTZ-283).

    Reproduz a analise que levou a correcao. Rodar na HML (precisa VPN).
    Caso do relato: fatura 1900000104 (KR), baixada pelo pagamento 1500000100 (KZ),
    que foi cancelado pelo estorno 1500000101.
*/

set nocount on;

-- 1) Estado contabil do trio fatura / pagamento / estorno.
--    O ponto-chave: apos o cancelamento a FATURA fica com clearing_is_reversed='X'
--    mas MANTEM is_cleared='X' e clearing_accounting_document preenchido.
select 'trio_do_caso' as diag,
       accounting_document as doc, accounting_document_item as item,
       financial_account_type as fat, posting_key as pk,
       accounting_document_type as doctype, accounting_document_type_name as doctype_nome,
       amount_in_company_code_currency as valor,
       is_cleared, clearing_is_reversed, is_reversed, is_reversal,
       clearing_accounting_document, reverse_document,
       status_para_envio, item_fluxo_de_caixa
from s4_extensao_dotz.dbo.registros_contabeis
where company_code = '0101' and fiscal_year = '2026'
  and accounting_document in ('1900000104', '1500000100', '1500000101')
order by accounting_document, accounting_document_item;

-- 2) Historico de envio ao XTPG (a view nao mostra o que ja saiu).
--    Evidencia do bug: a fatura saiu 200 -> 0 (quando o pagamento a baixou) e nao voltou.
select 'historico_envio_previsto' as diag,
       origem_pk, valor, status, id_xrt, criado_em
from s4_extensao_dotz.dbo.xtpg_envio_previsto_detail
where ltrim(rtrim(origem_pk)) like '0101-2026-1900000104-%'
order by criado_em;

-- 3) Populacao afetada: linhas cuja BAIXA foi revertida (pagamento cancelado) e que,
--    antes da correcao, caiam no bloco "Prev liquidados" saindo com Valor = 0.
--    A coluna valor_reaberto mostra o que passa a ser enviado (formula do bloco aberto).
select 'populacao_afetada' as diag,
       concat(company_code, '-', fiscal_year, '-', accounting_document, '-', accounting_document_item) as origem_pk,
       financial_account_type as fat,
       case when financial_account_type = 'K'
            then (amount_in_company_code_currency - withholding_tax_amount - cash_discount_amount_in_company_code_currency) * -1
            else (amount_in_company_code_currency - withholding_tax_amount - cash_discount_amount_in_company_code_currency)
       end as valor_reaberto,
       clearing_accounting_document, status_para_envio
from s4_extensao_dotz.dbo.registros_contabeis
where financial_account_type in ('K', 'D')
  and is_cleared is not null
  and clearing_is_reversed = 'X'
  and reverse_document is null
  and clearing_accounting_document is not null
  and clearing_accounting_document <> accounting_document
  and item_fluxo_de_caixa is not null
  and item_fluxo_de_caixa not in ('', '0', '999')
order by valor_reaberto desc;

-- 4) O que a view emite hoje para essas linhas (apos a correcao, bloco "Prev reaberto").
--    Obs.: a view filtra status_para_envio is null, entao so aparece o que esta pendente.
select 'view_atual' as diag, BlocoSAP, Nr_Doc_SAP, Valor, Flx_de_Caixa
from s4_extensao_dotz.dbo.XRT_SendPrevPagto
where BlocoSAP in ('Prev reaberto', 'Residual reaberto', 'Prev liquidados', 'Residual liquidados')
order by BlocoSAP, Valor desc;
