/*
    DTZ-284 - XRT_SendFlux ramo 30 (LCM): sinal do valor.

    Sintoma (validacao 13/08): LCM contra banco ia ao XTPG com valor NEGATIVO quando a
    linha do banco era CREDITO (debit_credit_code='H'), porque o ramo emitia
    amount_in_company_code_currency com o sinal nativo do S/4. Regra do cliente:
    negativo so em cancelamento do realizado.

    Correcao (so as 3 linhas de valor do ramo 30 'LCM'):
      case when rc.is_reversal='X' then -abs(...) else abs(...) end
    Original -> +abs; reversao -> -abs. Cancelamento de realizado segue no ramo 40
    ('Pagto Estorno CP', ja -abs), intocado.

    Backup da definicao anterior: _backup_HML_XRT_SendFlux_20260813_pre_sinal_lcm.sql
*/
ALTER VIEW [dbo].[XRT_SendFlux] as
with pgtos as (
--- Pagamentos nao revertidos
select company_code as p_company_code, fiscal_year as p_fiscal_year, accounting_document as p_accounting_document ,
clearing_item as P_clearing_item, posting_key p_posting_key , Clearing_date P_Clearing_date, clearing_doc_fiscal_year p_clear_doc_fiscal_year,
reverse_document  p_reverse_document, reverse_document_fiscal_year P_rev_doc_fiscal_year
from s4_extensao_dotz.dbo.registros_contabeis 
where clearing_accounting_document is not null 
and   clearing_accounting_document=accounting_document
and   Financial_account_type in('K','D') 
--and   posting_key in('05','08','15','18','25','28','35','38')  --- Documento de compensacao nao revertidos
and   reverse_document is null
--and   clearing_accounting_document='1400000000'
and   accounting_doc_created_by_user<>'BANKPLUS'
and   status_para_envio is null
--and 1=2
union
--- Pagamentos revertidos
select company_code as p_company_code, fiscal_year as p_fiscal_year, accounting_document as p_accounting_document ,
clearing_item as P_clearing_item, posting_key p_posting_key , Clearing_date P_Clearing_date, clearing_doc_fiscal_year p_clear_doc_fiscal_year,
reverse_document  p_reverse_document, reverse_document_fiscal_year P_rev_doc_fiscal_year
from s4_extensao_dotz.dbo.registros_contabeis 
where clearing_accounting_document is not null 
and Financial_account_type in('K','D') 
--and   reverse_document=clearing_accounting_document
--and   posting_key in('05','08','15','18','25','28','35','38')    --- Documento de compensacao nao revertidos
and   reverse_document is not null
and   reverse_document <> clearing_accounting_document
and   accounting_doc_created_by_user<>'BANKPLUS'
and   status_para_envio is null
--and 1=2
--and   clearing_accounting_document='1500000038'
),
lista as (
-- Nao revertidos
select p_company_code, p_fiscal_year, p_accounting_document ,  P_clearing_item, max(P_Clearing_date) P_Clearing_date , 
max(p_clear_doc_fiscal_year) p_clear_doc_fiscal_year, max(reverse_document) p_reverse_document, max(reverse_document_fiscal_year) P_rev_doc_fiscal_year,
sum( case when Financial_account_type in('K','D') and rc.is_cleared is null then amount_in_company_code_currency else 0 end) ValorResidual,
sum( case when Financial_account_type in('K','D')  then Withholding_tax_amount else 0 end) ImpostoRetido,
sum( case when Financial_account_type in('K','D') and clearing_accounting_document=p_accounting_document THEN amount_in_company_code_currency else 0 end)  ValorLiq_bruto,
sum( case when Financial_account_type in('K','D') then amount_in_company_code_currency else 0 end)  ValorLiquidado,
sum( case when Financial_account_type in('K','D') then cash_discount_amount_in_company_code_currency  else 0 end) Valor_descontos,
sum( case when Financial_account_type in('K','D') then amount_in_company_code_currency - cash_discount_amount_in_company_code_currency - rc.withholding_tax_amount else 0 end) ValorLiquido,
-- DTZ-284: caixa efetivo do documento de pagamento, lido das linhas de conta bancaria.
-- E o que de fato entrou ou saiu do banco, ja liquido de juros, multa, desconto e imposto
-- retido, sem depender de como cada componente foi lancado. Reconstruir esse total somando
-- componentes duplicava o imposto retido, que ja esta em withholding_tax_amount na linha K/D.
sum( case when cbx.gl_account is not null
     then -rc.amount_in_company_code_currency else 0 end) ValorCaixa
--sum( case when Financial_account_type in('K','D') then Net_payment_amount else 0 end) ValorLiquido

from pgtos
inner join s4_extensao_dotz.dbo.registros_contabeis rc on p_company_code=company_code 
													and p_fiscal_year=fiscal_year 
													and p_accounting_document =accounting_document 
left join s4_extensao_dotz.dbo.contas_bancarias cbx on rc.company_code = trim(cbx.codigo_cia) and rc.gl_account = trim(cbx.gl_account)
													group by p_company_code, p_fiscal_year, p_accounting_document, P_clearing_item
union
-- Revertidos
select p_company_code, p_fiscal_year, p_accounting_document ,  P_clearing_item, max(P_Clearing_date) P_Clearing_date , 
max(p_clear_doc_fiscal_year) p_clear_doc_fiscal_year, max(reverse_document) p_reverse_document, max(reverse_document_fiscal_year) P_rev_doc_fiscal_year,
sum( case when Financial_account_type in('K','D') and rc.is_cleared is null then amount_in_company_code_currency else 0 end) ValorResidual,
sum( case when Financial_account_type in('K','D')  then Withholding_tax_amount else 0 end) ImpostoRetido,
sum( case when Financial_account_type in('K','D') and clearing_accounting_document=p_reverse_document THEN amount_in_company_code_currency else 0 end)  ValorLiq_bruto,
sum( case when Financial_account_type in('K','D') then amount_in_company_code_currency else 0 end)  ValorLiquidado,
sum( case when Financial_account_type in('K','D') then cash_discount_amount_in_company_code_currency  else 0 end) Valor_descontos,
sum( case when Financial_account_type in('K','D') then amount_in_company_code_currency - cash_discount_amount_in_company_code_currency - rc.withholding_tax_amount else 0 end) ValorLiquido,
-- DTZ-284: caixa efetivo do documento de pagamento, lido das linhas de conta bancaria.
-- E o que de fato entrou ou saiu do banco, ja liquido de juros, multa, desconto e imposto
-- retido, sem depender de como cada componente foi lancado. Reconstruir esse total somando
-- componentes duplicava o imposto retido, que ja esta em withholding_tax_amount na linha K/D.
sum( case when cbx.gl_account is not null
     then -rc.amount_in_company_code_currency else 0 end) ValorCaixa
--sum( case when Financial_account_type in('K','D') then Net_payment_amount else 0 end) ValorLiquido
from pgtos
inner join s4_extensao_dotz.dbo.registros_contabeis rc on p_company_code=rc.company_code 
													and P_rev_doc_fiscal_year=rc.fiscal_year 
													and p_reverse_document   =rc.accounting_document 
													and p_reverse_document   =rc.reverse_document
left join s4_extensao_dotz.dbo.contas_bancarias cbx on rc.company_code = trim(cbx.codigo_cia) and rc.gl_account = trim(cbx.gl_account)
													group by p_company_code, p_fiscal_year, 
													p_accounting_document, P_clearing_item
)
,															
Lst_xtpg as (
-- Documentos Nao revertidos nao Bankplus
select p_company_code,  p_fiscal_year, p_accounting_document, P_clearing_item,
P_Clearing_date ,       p_clear_doc_fiscal_year, 
accounting_document     lst_account_document, 
fiscal_year             lst_fiscal_year,
Accounting_document_item lst_Accounting_document_item,
Financial_account_type Financ_acc_type,
amount_in_company_code_currency fatura,
ValorLiquidado,
ValorResidual,
Valor_descontos,
ValorLiquido,
ValorCaixa,

case when ValorLiq_bruto<>0 then round((amount_in_company_code_currency/ValorLiq_bruto)*(ValorLiquido+Valor_descontos), 2) 
else (ValorLiquido-Withholding_tax_amount) end as Valor_realizado,
cash_discount_amount_in_company_code_currency,

case when ValorLiq_bruto<>0 then round((amount_in_company_code_currency/ValorLiq_bruto)*(case when isnull(ValorCaixa,0) <> 0 then ValorCaixa else ValorLiquido+Valor_descontos end), 2) 
else (ValorLiquido-Withholding_tax_amount-cash_discount_amount_in_company_code_currency) end as Valor_realizado_com_desconto,
'Manual' Origem
from lista lst
inner join s4_extensao_dotz.dbo.registros_contabeis on P_company_code=company_code 
													and p_fiscal_year=clearing_doc_fiscal_year 
													and p_accounting_document =clearing_accounting_document 
													and P_clearing_item=clearing_item
where 1=1
and   accounting_document <> clearing_accounting_document
and   Financial_account_type in('K','D')
and   p_reverse_document is null
union-- Documentos revertidos nao Bankplus
select p_company_code,  p_fiscal_year, p_accounting_document, P_clearing_item,
P_Clearing_date ,       p_clear_doc_fiscal_year, 
accounting_document     lst_account_document, 
fiscal_year             lst_fiscal_year,
Accounting_document_item lst_Accounting_document_item,
Financial_account_type Financ_acc_type,
amount_in_company_code_currency fatura,
ValorLiquidado,
ValorResidual,
Valor_descontos,
ValorLiquido,
ValorCaixa,
case when ValorLiquidado<>0 
then round( (amount_in_company_code_currency/(ValorLiquidado-ValorResidual)*ValorLiquido ), 2) 
else (ValorLiquido-Withholding_tax_amount) end  as Valor_realizado,
cash_discount_amount_in_company_code_currency as cash_discount_amount_in_company_code_currency,

case when ValorLiquidado<>0 then round((amount_in_company_code_currency/ValorLiquidado)*(ValorLiquido) +Valor_descontos, 2) 
else (ValorLiquido-Withholding_tax_amount-cash_discount_amount_in_company_code_currency) end as Valor_realizado_com_desconto,
'Reversao' Origem
from lista lst
inner join s4_extensao_dotz.dbo.registros_contabeis on  P_company_code=company_code 
													and P_rev_doc_fiscal_year=sav_clear_doc_fiscal_year 
													and P_reverse_document =sav_clear_acc_doc 
													--and posting_key in('05','08','15','18','25','28','35','38')												
													--and P_clearing_item=sav_clear_item
where 1=1
--and posting_key not in('05','15','25','35','38') 
--and is_cleared='X' and clearing_is_reversed='X'
--and   accounting_document <> clearing_accounting_document
and   Financial_account_type in('K','D')
--and   p_reverse_document is not null
)
---- Documentos Manuais com pagamento revertido
--select * from lista
--select * from Lst_xtpg
select
1 ordem,
'Pagto Prev Rever' as BlocoSAP,
'LCM'  as tipo,
rc.Company_code as Empresa,
FORMAT(P_Clearing_date, 'dd/MM/yyyy')  as Data_de_lancamento,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',rc.sav_clear_acc_doc) as Chave_da_transacao,
rc.Accounting_document_item as Nr_da_Linha,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Referencia_base,
posting_key as Diario_original,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as Diario_original2,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Nr_Nota,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',rc.sav_clear_acc_doc) as Nr_Doc_SAP,
fncpgt.gl_account  as Codigo_da_conta, --- Conta Banco do Realizado
fncpgt.gl_account_name as Nome_da_conta,
fncBank.numero_banco_legado as Banco,
fncBank.numero_agencia_legado as Agencia,
fncBank.numero_conta_legado as Conta,
fncBank.digito_conta_legado as DV,
rc.item_fluxo_de_caixa as CFWId,
concat('Descricao ',rc.item_fluxo_de_caixa) as CFWName,
substring(concat(rc.Accounting_document_header_text,' ',rc.document_item_text),1, 44) as LineMemo,
case when financial_account_type ='K'  then Valor_realizado_com_desconto else Valor_realizado_com_desconto end *-1 as Liq,
case when financial_account_type ='K'  then Valor_realizado_com_desconto else Valor_realizado_com_desconto end *-1 as Valor_de_Debito,
case when financial_account_type ='K'  then Valor_realizado_com_desconto else Valor_realizado_com_desconto end *-1 as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_Pagamento,
isnull(rc.xtpg_conta_origem, fncCtra.gl_account)  as Conta_contabil,
isnull(isnull(rc.xtpg_conta_origem_nome, rc.xtpg_conta_origem),
       isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
       fncCtra.gl_account as Conta_contrapartida,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as OBJ,
concat(rc.Company_code,'-',rc.sav_clear_doc_fiscal_year,'-',rc.sav_clear_acc_doc,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as CHAVE,
-1 as temperatura,
'0' as Bloco,
rc.id_xrt as IdXRT,
DATEDIFF(day, rc.last_change_date, GETDATE()) as NumberOfDays,
substring (FORMAT(rc.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item,
clearing_accounting_document, 
clearing_doc_fiscal_year , 
clearing_item  ,
rc.reverse_document	, 
rc.reverse_document_fiscal_year,
p_fiscal_year               P_clear_fiscal_year, 
p_accounting_document       P_Clear_Account_Doc,
P_clearing_item,
null as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis	rc
CROSS APPLY dbo.fn_RetornaContaPagamento(rc.Company_code, rc.sav_clear_acc_doc , rc.sav_clear_doc_fiscal_year ,  rc.debit_credit_code) fncpgt
CROSS APPLY dbo.fn_RetornaContaBancaria(rc.Company_code, rc.house_bank , rc.house_bank_account , fncpgt.gl_account) fncbank
CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON rc.Company_code = cia.cia_id_sap
INNER JOIN Lst_xtpg on rc.company_code=p_company_code and rc.accounting_document=lst_account_document 
					and rc.fiscal_year=lst_fiscal_year and Accounting_document_item=lst_Accounting_document_item
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   Origem<>'BankPlus'
--and   posting_key in('01','11','31','21','36','16') 
--and   rc.clearing_accounting_document is not null
and   Origem='Reversao'
and   Rc.status_para_envio ='SUCESSO_PREV'
-- DTZ-284: nao reemitir a linha original quando o ramo 'Pagto Estorno CP' ja
-- cobre a mesma reversao. Os dois ramos disparavam no mesmo evento e este aqui
-- reusa a OrigemPk do realizado positivo, virando UPDATE do movimento no XTPG
-- (o +valor era sobrescrito por -valor) alem de duplicar o estorno.
and   not exists (
        select 'X'
        from s4_extensao_dotz.dbo.registros_contabeis rev2
        where rev2.company_code = rc.Company_code
          and rev2.is_reversal = 'X'
          and rev2.financial_account_type in ('K','D')
          and rev2.clearing_accounting_document = rev2.accounting_document
          and rev2.reverse_document <> rev2.clearing_accounting_document
          and rev2.reverse_document = rc.sav_clear_acc_doc
          and rev2.reverse_document_fiscal_year = rc.sav_clear_doc_fiscal_year
          and exists (
                select 'X' from s4_extensao_dotz.dbo.registros_contabeis orig2
                where orig2.company_code = rev2.company_code
                  and orig2.accounting_document = rev2.reverse_document
                  and orig2.reverse_document = orig2.clearing_accounting_document
                  and orig2.reverse_document = rev2.accounting_document
             )
     )
union
---- Documentos Manuais
select 
10 ordem,
'Pagto Previsto' as BlocoSAP,
'LCM'  as tipo,
rc.Company_code as Empresa,
FORMAT(P_Clearing_date, 'dd/MM/yyyy')  as Data_de_lancamento,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',rc.clearing_accounting_document) as Chave_da_transacao,
rc.Accounting_document_item as Nr_da_Linha,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Referencia_base,
posting_key as Diario_original,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as Diario_original2,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Nr_Nota,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',rc.clearing_accounting_document) as Nr_Doc_SAP,
fncpgt.gl_account  as Codigo_da_conta, --- Conta Banco do Realizado
fncpgt.gl_account_name as Nome_da_conta,
fncBank.numero_banco_legado as Banco,
fncBank.numero_agencia_legado as Agencia,
fncBank.numero_conta_legado as Conta,
fncBank.digito_conta_legado as DV,
rc.item_fluxo_de_caixa as CFWId,
concat('Descricao ',rc.item_fluxo_de_caixa) as CFWName,
substring(concat(rc.Accounting_document_header_text,' ',rc.document_item_text),1, 44) as LineMemo,
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end as Liq,
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end as Valor_de_Debito,
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_Pagamento,
isnull(rc.xtpg_conta_origem, fncCtra.gl_account)  as Conta_contabil,
isnull(isnull(rc.xtpg_conta_origem_nome, rc.xtpg_conta_origem),
       isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
       fncCtra.gl_account as Conta_contrapartida,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as OBJ,
concat(rc.Company_code,'-',rc.clearing_doc_fiscal_year,'-',rc.clearing_accounting_document,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as CHAVE,
-1 as temperatura,
'0' as Bloco,
rc.id_xrt as IdXRT,
DATEDIFF(day, rc.last_change_date, GETDATE()) as NumberOfDays,
substring (FORMAT(rc.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item,
rc.clearing_accounting_document, 
rc.clearing_doc_fiscal_year , 
rc.clearing_item  ,
rc.reverse_document	, 
rc.reverse_document_fiscal_year,
rc.clearing_doc_fiscal_year p_fiscal_year, 
rc.clearing_accounting_document p_accounting_document,
rc.clearing_item P_clearing_item,
'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis	rc
CROSS APPLY dbo.fn_RetornaContaPagamento(rc.Company_code, rc.clearing_accounting_document , rc.clearing_doc_fiscal_year ,  rc.debit_credit_code) fncpgt
CROSS APPLY dbo.fn_RetornaContaBancaria(rc.Company_code, rc.house_bank , rc.house_bank_account , fncpgt.gl_account) fncbank
CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON rc.Company_code = cia.cia_id_sap
INNER JOIN Lst_xtpg on rc.company_code=p_company_code and rc.accounting_document=lst_account_document 
					and rc.fiscal_year=lst_fiscal_year and Accounting_document_item=lst_Accounting_document_item
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   Origem<>'BankPlus'
--and   posting_key in('01','11','31','21','36','16') 
and   rc.clearing_accounting_document is not null
and   Origem='Manual'
and   Rc.status_para_envio ='SUCESSO_PREV'
union
---- Documentos BankPlus
select 
20 ordem,
'Pagto Prev Bank Plus' as BlocoSAP,
'LCM'  as tipo,
rc.Company_code as Empresa,
FORMAT(rc.Clearing_date, 'dd/MM/yyyy')  as Data_de_lancamento,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',rc.clearing_accounting_document) as Chave_da_transacao,
rc.Accounting_document_item as Nr_da_Linha,
isnull(rc.document_reference_id, concat('JE-',rc.accounting_document)) as Referencia_base,
rc.posting_key as Diario_original,
case when rc.financial_account_type ='D' then 'AR'
     when rc.financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as Diario_original2,
isnull(rc.document_reference_id, concat('JE-',rc.accounting_document)) as Nr_Nota,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',r21.accounting_document) as Nr_Doc_SAP,
fncpgt.gl_account  as Codigo_da_conta, --- Conta Banco do Realizado
fncpgt.gl_account_name as Nome_da_conta,
fncBank.numero_banco_legado as Banco,
fncBank.numero_agencia_legado as Agencia,
fncBank.numero_conta_legado as Conta,
fncBank.digito_conta_legado as DV,
rc.item_fluxo_de_caixa as CFWId,
concat('Descricao ',rc.item_fluxo_de_caixa) as CFWName,
substring(concat(rc.Accounting_document_header_text,' ',rc.document_item_text),1, 44) as LineMemo,
case when rc.financial_account_type ='K'  then r21.amount_in_company_code_currency*-1 else r21.amount_in_company_code_currency end as Liq,
case when rc.financial_account_type ='K'  then r21.amount_in_company_code_currency*-1 else r21.amount_in_company_code_currency end as Valor_de_Debito,
case when rc.financial_account_type ='K'  then r21.amount_in_company_code_currency*-1 else r21.amount_in_company_code_currency end as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_Pagamento,
isnull(rc.xtpg_conta_origem, fncCtra.gl_account)  as Conta_contabil,
isnull(isnull(rc.xtpg_conta_origem_nome, rc.xtpg_conta_origem),
       isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
       fncCtra.gl_account as Conta_contrapartida,
case when rc.financial_account_type ='D' then 'AR'
     when rc.financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as OBJ,
concat(rc.Company_code,'-',r21.fiscal_year,'-',r21.accounting_document,'-', rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as CHAVE,
-1 as temperatura,
'0' as Bloco,
rc.id_xrt as IdXRT,
DATEDIFF(day, rc.last_change_date, GETDATE()) as NumberOfDays,
substring (FORMAT(rc.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
RC.Company_code,
Rc.fiscal_year,
Rc.accounting_document,
Rc.Accounting_document_item,
rc.clearing_accounting_document, 
rc.clearing_doc_fiscal_year , 
rc.clearing_item  ,
rc.reverse_document	, 
rc.reverse_document_fiscal_year,
rc.clearing_doc_fiscal_year p_fiscal_year, 
rc.clearing_accounting_document p_accounting_document,
rc.clearing_item P_clearing_item,
'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis	R21
INNER JOIN s4_extensao_dotz.dbo.registros_contabeis RC on  R21.company_code = rc.company_code 
													 and substring(R21.assignment_reference,1, 4) = rc.fiscal_year  
													 and substring(R21.assignment_reference,5, 10) = rc.accounting_document
													 and cast(CAST(substring(r21.assignment_reference,15, 3) AS INT) as NCHAR(3)) = rc.Accounting_document_item													 
CROSS APPLY dbo.fn_RetornaContaPagamento(R21.Company_code, R21.accounting_document , r21.clearing_doc_fiscal_year ,  rc.debit_credit_code) fncpgt
CROSS APPLY dbo.fn_RetornaContaBancaria(rc.Company_code,  rc.house_bank , rc.house_bank_account , fncpgt.gl_account) fncbank
CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code,  rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia	cia                ON rc.Company_code = cia.cia_id_sap
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where R21.financial_account_type in ('K','D')
and   R21.posting_key ='21'
and   R21.clearing_accounting_document is not null
and   R21.accounting_doc_created_by_user='BANKPLUS'
and   RC.status_para_envio ='SUCESSO_PREV'
union
select 
30 ordem,
'LCM' as BlocoSAP,
'LCM'  as tipo,
rc.Company_code as Empresa,
FORMAT(rc.posting_date, 'dd/MM/yyyy')  as Data_de_lancamento,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Chave_da_transacao,
rc.Accounting_document_item as Nr_da_Linha,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Referencia_base,
posting_key as Diario_original,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     -- DTZ-284: linha G/L (documento SA) nao tem parceiro, entao caia no ELSE e ia como
     -- 'G/L', que a XTPG nao classifica. Passa a seguir a mesma convencao das linhas de
     -- parceiro, derivando o lado pelo debit_credit_code: 'H' (credito/saida) equivale a
     -- K -> AP; 'S' (debito/entrada) equivale a D -> AR.
     when isnull(origrev.debit_credit_code, rc.debit_credit_code) = 'H' then 'AP'
     ELSE 'AR' end as Diario_original2,
isnull(rc.document_reference_id, concat('JE-',accounting_document)) as Nr_Nota,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
rc.gl_account  as Codigo_da_conta, --- Conta Banco do Realizado
rc.gl_account_long_name as Nome_da_conta,
fncBank.numero_banco_legado as Banco,
fncBank.numero_agencia_legado as Agencia,
fncBank.numero_conta_legado as Conta,
fncBank.digito_conta_legado as DV,
rc.item_fluxo_de_caixa as CFWId,
concat('Descricao ',rc.item_fluxo_de_caixa) as CFWName,
substring(concat(rc.Accounting_document_header_text,' ',rc.document_item_text),1, 44) as LineMemo,
case when rc.is_reversal = 'X' then -abs(rc.Amount_in_company_code_currency) else abs(rc.Amount_in_company_code_currency) end as Liq,
case when rc.is_reversal = 'X' then -abs(rc.Amount_in_company_code_currency) else abs(rc.Amount_in_company_code_currency) end as Valor_de_Debito,
case when rc.is_reversal = 'X' then -abs(rc.Amount_in_company_code_currency) else abs(rc.Amount_in_company_code_currency) end as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K'
     -- DTZ-284: mesma logica do Diario_original2 - H (saida) = T, S (entrada) = K.
     when isnull(origrev.debit_credit_code, rc.debit_credit_code) = 'H' then 'T' else 'K' end as Forma_de_Pagamento,
-- DTZ-284: no ramo LCM a linha que dirige o movimento E a do banco, entao a conta do
-- proprio registro e a conta contabil do movimento. O fallback antes era a
-- contrapartida (fncCtra), que fazia a tag levar a conta do outro lado. O override do
-- xtpg_conta_origem (DTZ-273) continua valendo.
isnull(rc.xtpg_conta_origem, rc.gl_account)  as Conta_contabil,
isnull(isnull(rc.xtpg_conta_origem_nome, rc.xtpg_conta_origem),
       isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
       fncCtra.gl_account as Conta_contrapartida,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as OBJ,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as CHAVE,
-1 as temperatura,
'0' as Bloco,
rc.id_xrt as IdXRT,
DATEDIFF(day, rc.last_change_date, GETDATE()) as NumberOfDays,
substring (FORMAT(rc.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item,
null clearing_accounting_document, 
null clearing_doc_fiscal_year , 
null clearing_item  ,
null reverse_document	, 
null reverse_document_fiscal_year,
null p_fiscal_year, 
null p_accounting_document,
null P_clearing_item,
'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis	rc
CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fncCtra
CROSS APPLY dbo.fn_RetornaContaBancaria(rc.Company_code, rc.house_bank , rc.house_bank_account , rc.gl_account) fncbank
-- DTZ-284: num documento de estorno o lancamento e espelhado, entao o debit_credit_code
-- da propria linha aponta o lado CONTRARIO ao do movimento que ele desfaz. Para a linha de
-- reversao a classificacao vem do documento ORIGINAL (reverse_document), casada pela mesma
-- conta e mesmo valor absoluto. Sem correspondencia, mantem o comportamento anterior.
OUTER APPLY (
  select top 1 orig.debit_credit_code
  from s4_extensao_dotz.dbo.registros_contabeis orig
  where rc.is_reversal = 'X'
    and rc.reverse_document is not null
    and orig.company_code = rc.company_code
    and orig.fiscal_year = rc.fiscal_year
    and orig.accounting_document = rc.reverse_document
    and orig.gl_account = rc.gl_account
    and abs(orig.amount_in_company_code_currency) = abs(rc.amount_in_company_code_currency)
  order by orig.accounting_document_item
) origrev
INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON rc.Company_code = cia.cia_id_sap
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where rc.accounting_document_type in('SA','AB')
and exists(select 'X' from contas_bancarias cb
where rc.company_code =trim(cb.codigo_cia)
and   rc.gl_account =trim(cb.gl_account))
and   rc.status_para_envio is null
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
and   rc.accounting_doc_created_by_user<>'BANKPLUS'

union
-- DTZ-262/DTZ-245: Pagto Estorno CP (estorno-so-do-CP, topologia colapsada rev=clearing)
select
  40 ordem,
  'Pagto Estorno CP' as BlocoSAP,
  'LCM'  as tipo,
  rev.Company_code as Empresa,
  FORMAT(rev.posting_date, 'dd/MM/yyyy')  as Data_de_lancamento,
  concat(rev.Company_code,'-',rev.fiscal_year,'-',rev.accounting_document,'-',rev.Accounting_document_item,'-',rev.reverse_document) as Chave_da_transacao,
  rev.Accounting_document_item as Nr_da_Linha,
  isnull(rev.document_reference_id, concat('JE-',rev.accounting_document)) as Referencia_base,
  rev.posting_key as Diario_original,
  case when rev.financial_account_type ='D' then 'AR' when rev.financial_account_type ='K' then 'AP' ELSE 'G/L' end as Diario_original2,
  isnull(rev.document_reference_id, concat('JE-',rev.accounting_document)) as Nr_Nota,
  concat(rev.Company_code,'-',rev.fiscal_year,'-',rev.accounting_document,'-',rev.Accounting_document_item,'-',rev.reverse_document) as Nr_Doc_SAP,
  fncpgt.gl_account  as Codigo_da_conta,
  fncpgt.gl_account_name as Nome_da_conta,
  fncBank.numero_banco_legado as Banco,
  fncBank.numero_agencia_legado as Agencia,
  fncBank.numero_conta_legado as Conta,
  fncBank.digito_conta_legado as DV,
  rev.item_fluxo_de_caixa as CFWId,
  concat('Descricao ',rev.item_fluxo_de_caixa) as CFWName,
  substring(concat(rev.Accounting_document_header_text,' ',rev.document_item_text),1, 44) as LineMemo,
  isnull(-realizado.valor_enviado, -abs(rev.amount_in_company_code_currency)) as Liq,
  isnull(-realizado.valor_enviado, -abs(rev.amount_in_company_code_currency)) as Valor_de_Debito,
  isnull(-realizado.valor_enviado, -abs(rev.amount_in_company_code_currency)) as Valor_de_Credito,
  isnull(isnull(rev.customer, rev.supplier),'') as Cod_Fornecedor,
  substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
  ocrd.CNPJ as CNPJ_Fornecedor,
  case when rev.financial_account_type ='K' then 'T' when rev.financial_account_type ='D' then 'K' else rev.payment_method end as Forma_de_Pagamento,
  isnull(rev.xtpg_conta_origem, fncCtra.gl_account)  as Conta_contabil,
  isnull(isnull(rev.xtpg_conta_origem_nome, rev.xtpg_conta_origem),
         isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
         fncCtra.gl_account as Conta_contrapartida,
  case when rev.financial_account_type ='D' then 'AR' when rev.financial_account_type ='K' then 'AP' ELSE 'G/L' end as OBJ,
  concat(rev.Company_code,'-',rev.clearing_doc_fiscal_year,'-',rev.clearing_accounting_document,'-',rev.fiscal_year,'-',rev.accounting_document,'-',rev.Accounting_document_item) as CHAVE,
  -1 as temperatura,
  '0' as Bloco,
  rev.id_xrt as IdXRT,
  DATEDIFF(day, rev.last_change_date, GETDATE()) as NumberOfDays,
  substring (FORMAT(rev.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
  rev.Company_code,
  rev.fiscal_year,
  rev.accounting_document,
  rev.Accounting_document_item,
  rev.clearing_accounting_document,
  rev.clearing_doc_fiscal_year,
  rev.clearing_item,
  rev.reverse_document,
  rev.reverse_document_fiscal_year,
  rev.clearing_doc_fiscal_year p_fiscal_year,
  rev.clearing_accounting_document p_accounting_document,
  rev.clearing_item P_clearing_item,
  'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis rev
CROSS APPLY dbo.fn_RetornaContaPagamento(rev.Company_code, rev.clearing_accounting_document , rev.clearing_doc_fiscal_year ,  rev.debit_credit_code) fncpgt
CROSS APPLY dbo.fn_RetornaContaBancaria(rev.Company_code, rev.house_bank , rev.house_bank_account , fncpgt.gl_account) fncbank
CROSS APPLY dbo.fn_RetornaContraPartida(rev.Company_code, rev.accounting_document , rev.Fiscal_Year, rev.Posting_key, rev.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia	cia ON rev.Company_code = cia.cia_id_sap
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd on isnull(isnull(rev.customer, rev.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
-- DTZ-284: valor do realizado que de fato foi enviado para a linha compensada por este
-- pagamento. A OrigemPk do realizado e montada pelo ramo 'Pagto Previsto' como
-- {empresa}-{ano}-{doc compensado}-{item}-{doc de compensacao}.
OUTER APPLY (
  select top 1 try_convert(decimal(18,2), env.valor) as valor_enviado
  from s4_extensao_dotz.dbo.registros_contabeis fat
  inner join s4_extensao_dotz.dbo.xtpg_envio_realizado_detail env
          on env.status = 'ENVIADO'
         and env.origem_pk = concat(fat.company_code,'-',fat.fiscal_year,'-',
                                    fat.accounting_document,'-',fat.accounting_document_item,'-',
                                    rev.reverse_document)
  where fat.company_code = rev.company_code
    -- DTZ-284: quando a compensacao e estornada o S/4 limpa clearing_accounting_document
    -- na fatura (ela volta em aberto) e preserva o documento em sav_clear_acc_doc. Casar
    -- so pelo campo corrente nao achava o realizado e o estorno saia com -abs(valor da
    -- linha), ou seja, o valor cheio da fatura em vez do que de fato foi pago.
    and isnull(fat.clearing_accounting_document, fat.sav_clear_acc_doc) = rev.reverse_document
    and fat.accounting_document <> isnull(fat.clearing_accounting_document, fat.sav_clear_acc_doc)
    and fat.financial_account_type in ('K','D')
    and abs(fat.amount_in_company_code_currency) = abs(rev.amount_in_company_code_currency)
  order by env.criado_em desc
) realizado
where rev.is_reversal='X'
and   rev.financial_account_type in ('K','D')
and   rev.clearing_accounting_document = rev.accounting_document
and   rev.reverse_document <> rev.clearing_accounting_document
-- DTZ-284: so a linha que estorna a compensacao da fatura carrega o movimento. Num
-- pagamento parcial residual o documento de estorno traz tambem a linha espelho do
-- item residual, que nao corresponde a nenhum realizado enviado.
-- O filtro so vale quando o documento de estorno TEM uma linha carregadora: se nenhuma
-- linha estiver marcada (pagamento sem fatura, por exemplo), o ramo segue emitindo
-- todas como antes, para que nenhum estorno deixe de ser enviado.
and   ( rev.clearing_is_reversed = 'X'
        or not exists (
             select 'X'
             from s4_extensao_dotz.dbo.registros_contabeis outra
             where outra.company_code = rev.company_code
               and outra.fiscal_year = rev.fiscal_year
               and outra.accounting_document = rev.accounting_document
               and outra.financial_account_type in ('K','D')
               and outra.clearing_is_reversed = 'X'
           ) )
and   rev.status_para_envio is null
and   exists (
        select 'X' from s4_extensao_dotz.dbo.registros_contabeis orig
        where orig.company_code = rev.company_code
          and orig.accounting_document = rev.reverse_document
          and orig.reverse_document = orig.clearing_accounting_document
          and orig.reverse_document = rev.accounting_document
     )
;




