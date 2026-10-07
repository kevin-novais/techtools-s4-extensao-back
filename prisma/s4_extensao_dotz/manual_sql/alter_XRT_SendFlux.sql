-- dbo.XRT_SendFlux_P2026_07_02 fonte

-- dbo.XRT_SendFlux fonte

ALTER VIEW [dbo].[XRT_SendFlux] as
with pgtos as (
--- Pagamentos não revertidos
select company_code as p_company_code, fiscal_year as p_fiscal_year, accounting_document as p_accounting_document ,
clearing_item as P_clearing_item, posting_key p_posting_key , Clearing_date P_Clearing_date, clearing_doc_fiscal_year p_clear_doc_fiscal_year,
reverse_document  p_reverse_document, reverse_document_fiscal_year P_rev_doc_fiscal_year
from s4_extensao_dotz.dbo.registros_contabeis 
where clearing_accounting_document is not null 
and   clearing_accounting_document=accounting_document
and   Financial_account_type in('K','D') 
--and   posting_key in('05','08','15','18','25','28','35','38')  --- Documento de compensacao não revertidos
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
--and   posting_key in('05','08','15','18','25','28','35','38')    --- Documento de compensacao não revertidos
and   reverse_document is not null
and   reverse_document <> clearing_accounting_document
and   accounting_doc_created_by_user<>'BANKPLUS'
--and   status_para_envio is null
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
sum( case when Financial_account_type in('K','D') then Net_payment_amount else 0 end) ValorLiquido
--sum( case when Financial_account_type in('K','D') then amount_in_company_code_currency-cash_discount_amount_in_company_code_currency-Withholding_tax_amount else 0 end)  ValorLiquido

from pgtos
inner join s4_extensao_dotz.dbo.registros_contabeis rc on p_company_code=company_code 
													and p_fiscal_year=fiscal_year 
													and p_accounting_document =accounting_document 
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
sum( case when Financial_account_type in('K','D') then Net_payment_amount else 0 end) ValorLiquido
from pgtos
inner join s4_extensao_dotz.dbo.registros_contabeis rc on p_company_code=rc.company_code 
													and P_rev_doc_fiscal_year=rc.fiscal_year 
													and p_reverse_document   =rc.accounting_document 
													and p_reverse_document   =rc.reverse_document
													group by p_company_code, p_fiscal_year, 
													p_accounting_document, P_clearing_item
)
,															
Lst_xtpg as (
-- Documentos Não revertidos não Bankplus
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

case when ValorLiq_bruto<>0 then round((amount_in_company_code_currency/ValorLiq_bruto)*(ValorLiquido+Valor_descontos), 2) 
else (ValorLiquido-Withholding_tax_amount) end as Valor_realizado,
cash_discount_amount_in_company_code_currency,

case when ValorLiq_bruto<>0 then round((amount_in_company_code_currency/ValorLiq_bruto)*(ValorLiquido+Valor_descontos), 2) 
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
union-- Documentos revertidos não Bankplus
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
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end *-1 as Liq,
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end *-1 as Valor_de_Debito,
case when financial_account_type ='K'  then Valor_realizado_com_desconto*-1 else Valor_realizado_com_desconto end *-1 as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.payment_method is null AND financial_account_type ='D'  then 'E' 
	 when rc.payment_method is null AND financial_account_type ='K'  then 'T' 
     else rc.payment_method end as Forma_de_Pagamento,
fncCtra.gl_account  as Conta_contabil,
fncpgt.gl_account_name as Descr_Conta_contabil,
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
case when rc.payment_method is null AND financial_account_type ='D'  then 'E' 
	 when rc.payment_method is null AND financial_account_type ='K'  then 'T' 
     else rc.payment_method end as Forma_de_Pagamento,
fncCtra.gl_account  as Conta_contabil,
fncpgt.gl_account_name as Descr_Conta_contabil,
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
case when rc.payment_method is null AND rc.financial_account_type ='D'  then 'E' 
	 when rc.payment_method is null AND rc.financial_account_type ='K'  then 'T' 
     else rc.payment_method end as Forma_de_Pagamento,
fncCtra.gl_account  as Conta_contabil,
fncpgt.gl_account_name as Descr_Conta_contabil,
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
     ELSE 'G/L' end as Diario_original2,
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
rc.Amount_in_company_code_currency as Liq,
rc.Amount_in_company_code_currency as Valor_de_Debito,
rc.Amount_in_company_code_currency as Valor_de_Credito,
isnull(isnull(rc.customer, rc.supplier),'') as Cod_Fornecedor,
substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
ocrd.CNPJ as CNPJ_Fornecedor,
case when rc.payment_method is null AND financial_account_type ='D'  then 'E' 
	 when rc.payment_method is null AND financial_account_type ='K'  then 'T' 
     else rc.payment_method end as Forma_de_Pagamento,
fncCtra.gl_account  as Conta_contabil,
rc.gl_account_long_name as Descr_Conta_contabil,
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
INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON rc.Company_code = cia.cia_id_sap
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where rc.accounting_document_type in('SA','AB')
and exists(select 'X' from contas_bancarias cb
where rc.company_code =trim(cb.codigo_cia)
and   rc.gl_account =trim(cb.gl_account))
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
and   rc.accounting_doc_created_by_user<>'BANKPLUS';