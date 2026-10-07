-- dbo.XRT_SendPrevPagto fonte

ALTER VIEW [dbo].[XRT_SendPrevPagto]
-- View com os documentos a pagar e receber pendentes de pagamentos
-- A view é composta por 3 blocos 
AS
Select 
'Prev aberto' as BlocoSAP,            
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end, 1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
case when financial_account_type ='K'  then (rc.Amount_in_company_code_currency-withholding_tax_amount-cash_discount_amount_in_company_code_currency)*-1 else (rc.Amount_in_company_code_currency-withholding_tax_amount-cash_discount_amount_in_company_code_currency) end  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item)  as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,   
     FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE()) NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'0' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia                    ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 	
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D') -- K Contas a Pagar e D Contas a Receber
and   rc.posting_key not in('09','19','29','39')
and   rc.posting_key not in('06','16','26','36')
--and   exists(select '' from s4_extensao_dotz.dbo.fluxo_caixa_cia_tipo_lancamento xtpc where xtpc.posting_key='00' and xtpc.company_code=rc.company_code and xtpc.document_type=rc.accounting_document_type)
and   rc.clearing_accounting_document is null
and   rc.reverse_document is null
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
--and   rc.bloco='0' ----- Durante Testes Individuais
---- Residuais
union
Select 
'Prev aberto residual' as BlocoSAP,            
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end, 1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
case when financial_account_type ='K'  then (rc.Amount_in_company_code_currency-withholding_tax_amount-cash_discount_amount_in_company_code_currency)*-1 else (rc.Amount_in_company_code_currency-withholding_tax_amount-cash_discount_amount_in_company_code_currency) end  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item)  as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,   
     FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE()) NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'0' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 	
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D') -- K Contas a Pagar e D Contas a Receber
and   rc.posting_key in('06','16','26','36')
and   rc.clearing_accounting_document is null
and   rc.reverse_document is null
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
--and   rc.bloco='0' ----- Durante Testes Individuais
union
select 
'Prev aberto Rev' as BlocoSAP,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end,1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy')  as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end  as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,
FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE())  as NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'1' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 	
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   rc.posting_key not in('09','19','29','39')
and   rc.posting_key not in('06','16','26','36')
and   reverse_document is not null 
and   rc.is_reversed ='X'
and   clearing_is_reversed is null
--and   exists(select '' from s4_extensao_dotz.dbo.fluxo_caixa_cia_tipo_lancamento xtpc  where xtpc.posting_key='00' and xtpc.company_code=rc.company_code and xtpc.document_type=rc.accounting_document_type)
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
union
select 
'Reversao Residual' as BlocoSAP,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end,1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy')  as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end  as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,
FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE())  as NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'1' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 	
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   rc.posting_key in('06','16','26','36')
and   reverse_document is not null 
and   rc.is_reversal ='X'
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
--and   rc.clearing_is_reversed is null
--and   rc.id_xrt is not null
--and   rc.bloco='0' ----- Durante Testes Individuais
union
select 
'Prev liquidados' as BlocoSAP,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end,1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy')  as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,
FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE())  as NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'2' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 		LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   rc.posting_key not in('09','19','29','39')
and   rc.posting_key not in('06','16','26','36')
--and   exists(select '' from s4_extensao_dotz.dbo.fluxo_caixa_cia_tipo_lancamento xtpc  where xtpc.posting_key='00' and xtpc.company_code=rc.company_code and xtpc.document_type=rc.accounting_document_type)
and   rc.is_cleared is not null
and   rc.clearing_accounting_document is not null
and   reverse_document is null 
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999')
and   rc.clearing_accounting_document<>accounting_document
union
select 
'Residual liquidados' as BlocoSAP,
case when financial_account_type ='D' then 'AR'
     when financial_account_type ='K' then 'AP'
     ELSE 'G/L' end as ObjType,
1 as Temperatura,
SUBSTRING(case when financial_account_type ='D' then clie.CardName 
     else forn.CardName  end,1, 30) as CardName,
SUBSTRING(isnull(rc.document_reference_id, concat('JE-',accounting_document)),1,15) as DOC_ORIGEM,
isnull(cb.numero_banco_legado, cbdft.numero_banco_legado) as Banco,
isnull(cb.numero_agencia_legado, cbdft.numero_agencia_legado) as Agencia,
isnull(cb.numero_conta_legado,   cbdft.numero_conta_legado) as Conta,
isnull(cb.digito_conta_legado,   cbdft.digito_conta_legado) as DV,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as AcctCode,
FORMAT(rc.net_due_date, 'dd/MM/yyyy')  as Dt_Lancamento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Vencimento,
FORMAT(rc.net_due_date, 'dd/MM/yyyy') as Pagamento,
rc.accounting_document_item as Prestacao,
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when financial_account_type ='K' then 'T' when financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as Nr_Doc_SAP,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item) as DocEntry,
case when fncCpd.gl_account='ZZZZZZZZZZ' then fnc.gl_account else fncCpd.gl_account end as Conta_contabil,
case when financial_account_type ='D' then rc.customer 
     else rc.supplier  end as fornecedor,
case when financial_account_type ='D' then clie.CNPJ 
     else forn.CNPJ  end as CNPJ_fornecedor,
substring( (case when rc.Accounting_document_header_text is not null then concat(rc.Accounting_document_header_text,' ',rc.document_item_text) 
     when rc.document_item_text is not null then rc.document_item_text
     else rc.accounting_document_type_name end), 1, 44) as comments,
FORMAT(rc.last_change_date, 'dd/MM/yyyy') as UpdateDate,
DATEDIFF(day, rc.last_change_date, GETDATE())  as NumberOfDays,
rc.id_xrt as U_XRTId,
rc.posting_key as ObjTypeSAP,
'2' as Bloco,
' ' as Coluna1,
rc.Company_code,
rc.fiscal_year,
rc.accounting_document,
rc.Accounting_document_item
from s4_extensao_dotz.dbo.registros_contabeis	rc
	CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fnc
	CROSS APPLY dbo.fn_RetornaContraPartidaDireto(rc.Company_code, rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code, rc.Amount_in_company_code_currency) fncCpd
	INNER JOIN s4_extensao_dotz.dbo.cia	cia              ON  rc.Company_code = cia.cia_id_sap
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_contabeis cc  ON  rc.Company_code =     cc.Company_code 
	 													       and rc.chart_of_accounts =cc.chart_of_accounts
	                                                           and isnull (fncCpd.gl_account, fnc.gl_account)=       cc.gl_account
	LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cb on rc.Company_code = cb.codigo_cia
															  and  rc.house_bank = cb.house_bank
														 	  and rc.house_bank_account = cb.house_bank_account													 
 		LEFT OUTER JOIN  s4_extensao_dotz.dbo.contas_bancarias cbdft on rc.Company_code = cbdft.codigo_cia   
														         and '#DFT' = cbdft.house_bank
														         and '#DFT' = cbdft.house_bank_account													 
	LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD clie     on  rc.customer COLLATE DATABASE_DEFAULT = clie.cardcode COLLATE DATABASE_DEFAULT
    LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD forn     on  rc.supplier COLLATE DATABASE_DEFAULT = forn.cardcode COLLATE DATABASE_DEFAULT
where rc.financial_account_type in ('K','D')
and   rc.posting_key in('06','16','26','36')
and   rc.is_cleared is not null
and   rc.clearing_accounting_document is not null
and   reverse_document is null 
and   rc.status_para_envio is null
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '999');