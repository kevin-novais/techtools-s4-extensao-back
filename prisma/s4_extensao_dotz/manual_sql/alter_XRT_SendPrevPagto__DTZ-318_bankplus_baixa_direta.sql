/*
    DTZ-318 - Baixa de contas a pagar via BankPlus SEM documento de compensacao (topologia direta).

    Sintoma (invent, 15/09): titulo 1500000147. No previsto saiu -12,12 (a linha K pk21 do
    PAGAMENTO caia no bloco 'Prev aberto', K -> valor*-1) e a fatura nunca era baixada (o
    'Prev liquidados' exige clearing not null, ausente nessa topologia).

    Correcao:
    1. 'Prev aberto': exclui a linha K pk21 do pagamento BankPlus (fantasma) e exclui a fatura
       baixada por baixa direta BankPlus (roteada ao bloco zero).
    2. Novo bloco 'Prev liquidados Bank Direto': emite a fatura com Valor 0 (baixa do previsto),
       identificada por um pagamento BankPlus pk21 clearing-null ligado pela assignment_reference.

    Depende do reset de status_para_envio da fatura no SyncRegistrosContabeisService (na chegada
    do pagamento), analogo ao DTZ-245, para a fatura reentrar na view e ser zerada.

    DTZ-318 AR (18/09): mesma topologia na perna de RECEBIMENTO (contas a receber). O "Retorno
    bancario" do BankPlus e um doc SA com a linha do cliente (pk 11/15, D) NEGATIVA e clearing
    NULL. Para AR o Valor nao e invertido, entao essa linha vazava crua como previsto negativo
    ("entrou na previsao"). Correcao espelhada: 'Prev aberto' exclui o fantasma (pk 11/15, D,
    BankPlus, clearing NULL) e a fatura AR baixada por ele; novo bloco 'Prev liquidados AR Bank
    Direto' zera a fatura. O vinculo recebimento->fatura e deterministico por
    payment_reference (fatura) = document_reference_id (recebimento) - diferente do AP, cujo
    assignment_reference encoda ano+doc+item. Tambem depende do reset de status no sync.

    DTZ-318 IMPOSTO RETIDO (21/09, validado pela invent): o previsto enviava
    (valor da NF - withholding_tax_amount), que NAO e a retencao efetiva do titulo. Na linha da
    FATURA o SAP grava a base em withholding_tax_base_amount e apenas uma parcela em
    withholding_tax_amount; a retencao real e (base - imposto) - o mesmo valor que aparece como
    withholding_tax_amount na linha K/D do documento de PAGAMENTO. Exemplo 5100000320: NF 108.350,
    base 6.765, imposto 1.650 -> previsto saia 106.700, mas o caixa efetivo foi 103.235
    (= 108.350 - (6.765 - 1.650)), que e o que o realizado ja emitia. O previsto passa a usar
    (base - imposto), fechando previsto x realizado. Vale para AP (K) e AR (D).

    GUARDA (nao pedida pela invent, exigida pelos dados da HML): a formula crua quebra em 35 dos
    199 titulos abertos com base preenchida. Mantem-se o comportamento antigo (imposto) quando:
    (a) a base nao esta preenchida; (b) base = imposto - a base foi preenchida com o proprio
    imposto, e (base-imposto)=0 zeraria a retencao (33 titulos, inclusive um AR de 478.743,09);
    (c) abs(base-imposto) >= abs(valor do titulo) - a retencao superaria o titulo e INVERTERIA O
    SINAL do previsto (2 titulos AP: 5100000050 iria a +2.245,82 e 5100000056 a 0). Sem a guarda
    reintroduziriamos exatamente o sintoma de "previsto negativo/invertido" deste chamado.
    Os 162 titulos restantes recebem a correcao. Os casos (b) e (c) precisam de posicionamento da
    invent sobre o preenchimento da base na origem.

    Backup da definicao anterior: _backup_HML_XRT_SendPrevPagto_20260915_pre_DTZ-318.sql
*/
ALTER VIEW [dbo].[XRT_SendPrevPagto]
-- View com os documentos a pagar e receber pendentes de pagamentos
-- A view Æ’?1A"AÂ®Æ’?1A"AÂ®Æ’?1A"AÂ® composta por 3 blocos 
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
-- DTZ-318 imposto retido: retencao efetiva = (base - imposto), com guarda (ver cabecalho).
case when financial_account_type ='K'  then (rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency)*-1 else (rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency) end  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
-- DTZ-318: baixa direta BankPlus (sem doc de compensacao). Nao emitir a linha K pk21 do
-- pagamento como previsto aberto (fantasma negativo) nem reemitir a fatura baixada por essa
-- topologia - a fatura vai a zero no bloco 'Prev liquidados Bank Direto'.
and   not ( rc.accounting_doc_created_by_user='BANKPLUS' and rc.posting_key='21' )
and   not exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis pay
      where pay.company_code = rc.company_code
        and pay.accounting_doc_created_by_user='BANKPLUS' and pay.posting_key='21'
        and pay.financial_account_type in ('K','D')
        and pay.clearing_accounting_document is null
        and substring(pay.assignment_reference,1,4) = rc.fiscal_year
        and substring(pay.assignment_reference,5,10) = rc.accounting_document
        and cast(cast(substring(pay.assignment_reference,15,3) as int) as nchar(3)) = rc.Accounting_document_item)
-- DTZ-318 AR: recebimento direto BankPlus (retorno bancario, sem doc de compensacao). A linha
-- do cliente (pk 11/15, D, clearing NULL) e uma baixa, nao um previsto: para AR o Valor nao e
-- invertido, entao ela saia crua como previsto NEGATIVO. Nao emitir esse fantasma; e a fatura AR
-- baixada por esse recebimento (ligada por payment_reference = document_reference_id do
-- recebimento) vai a zero no bloco 'Prev liquidados AR Bank Direto'.
and   not ( rc.accounting_doc_created_by_user='BANKPLUS' and rc.financial_account_type='D'
            and rc.posting_key in ('11','15') and rc.clearing_accounting_document is null )
and   not exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis rcv
      where rcv.company_code = rc.company_code
        and rcv.accounting_doc_created_by_user='BANKPLUS'
        and rcv.financial_account_type='D' and rcv.posting_key in ('11','15')
        and rcv.clearing_accounting_document is null
        and rcv.document_reference_id is not null
        and rcv.document_reference_id = rc.payment_reference)
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
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
-- DTZ-318 imposto retido: retencao efetiva = (base - imposto), com guarda (ver cabecalho).
case when financial_account_type ='K'  then (rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency)*-1 else (rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency) end  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
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
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
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
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
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
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
and   ( rc.clearing_is_reversed is null
        or not exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis crev
                where crev.company_code = rc.company_code
                  and crev.accounting_document = rc.clearing_accounting_document
                  and (crev.is_reversed = 'X' or crev.is_reversal = 'X')) )
and   rc.status_para_envio is null
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
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
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
and   ( rc.clearing_is_reversed is null
        or not exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis crev
                where crev.company_code = rc.company_code
                  and crev.accounting_document = rc.clearing_accounting_document
                  and (crev.is_reversed = 'X' or crev.is_reversal = 'X')) )
and   rc.status_para_envio is null
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
union
select 
'Prev reaberto' as BlocoSAP,
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
-- DTZ-318 imposto retido: retencao efetiva = (base - imposto), com guarda (ver cabecalho).
abs(rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency)  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
and   rc.clearing_is_reversed = 'X'
and   exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis crev
                where crev.company_code = rc.company_code
                  and crev.accounting_document = rc.clearing_accounting_document
                  and (crev.is_reversed = 'X' or crev.is_reversal = 'X'))
and   rc.status_para_envio is null
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
and   rc.clearing_accounting_document<>accounting_document
union
select 
'Residual reaberto' as BlocoSAP,
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
-- DTZ-318 imposto retido: retencao efetiva = (base - imposto), com guarda (ver cabecalho).
abs(rc.Amount_in_company_code_currency-(case when isnull(rc.withholding_tax_base_amount,0)=0 or rc.withholding_tax_base_amount=rc.withholding_tax_amount or abs(rc.withholding_tax_base_amount-rc.withholding_tax_amount)>=abs(rc.Amount_in_company_code_currency) then isnull(rc.withholding_tax_amount,0) else rc.withholding_tax_base_amount-rc.withholding_tax_amount end)-cash_discount_amount_in_company_code_currency)  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
and   rc.clearing_is_reversed = 'X'
and   exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis crev
                where crev.company_code = rc.company_code
                  and crev.accounting_document = rc.clearing_accounting_document
                  and (crev.is_reversed = 'X' or crev.is_reversal = 'X'))
and   rc.status_para_envio is null
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')

union
-- DTZ-318: 'Prev liquidados Bank Direto'. Baixa direta BankPlus (clearing NULL): a fatura
-- baixada por um pagamento BankPlus (pk 21, K) ligado pela assignment_reference vai a ZERO
-- no previsto (mesma OrigemPk da fatura), espelhando o 'Prev liquidados' que so cobre baixas
-- com doc de compensacao. Depende do reset de status da fatura no sync (chegada do pagamento).
Select 
'Prev liquidados Bank Direto' as BlocoSAP,            
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
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa  
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa    
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto, 
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
'2' as Bloco,
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
and   exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis pay
      where pay.company_code = rc.company_code
        and pay.accounting_doc_created_by_user='BANKPLUS' and pay.posting_key='21'
        and pay.financial_account_type in ('K','D')
        and pay.clearing_accounting_document is null
        and substring(pay.assignment_reference,1,4) = rc.fiscal_year
        and substring(pay.assignment_reference,5,10) = rc.accounting_document
        and cast(cast(substring(pay.assignment_reference,15,3) as int) as nchar(3)) = rc.Accounting_document_item)
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
--and   rc.bloco='0' ----- Durante Testes Individuais
---- Residuais
union
-- DTZ-318 AR: 'Prev liquidados AR Bank Direto'. Recebimento direto BankPlus (retorno bancario,
-- clearing NULL): a fatura AR (RV/DR, pk 01/06, clearing NULL) baixada por um recebimento
-- BankPlus (pk 11/15, D) ligado por payment_reference = document_reference_id do recebimento vai
-- a ZERO no previsto (mesma OrigemPk da fatura), espelhando 'Prev liquidados' que so cobre baixas
-- com doc de compensacao. Depende do reset de status da fatura no sync (chegada do recebimento).
Select
'Prev liquidados AR Bank Direto' as BlocoSAP,
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
0  as Valor,
case when  rc.item_fluxo_de_caixa is not null then rc.item_fluxo_de_caixa
     when  cc.item_fluxo_de_caixa is not null then cc.item_fluxo_de_caixa
     else  rc.item_fluxo_de_caixa end as Flx_de_Caixa,
     rc.Company_code as Empresa,
case when rc.financial_account_type ='K' then 'T' when rc.financial_account_type ='D' then 'K' else rc.payment_method end as Forma_de_pgto,
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
'2' as Bloco,
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
where rc.financial_account_type = 'D' -- D Contas a Receber
and   rc.posting_key in ('01','06')
and   rc.clearing_accounting_document is null
and   rc.reverse_document is null
and   rc.status_para_envio is null
and   exists (select 'X' from s4_extensao_dotz.dbo.registros_contabeis rcv
      where rcv.company_code = rc.company_code
        and rcv.accounting_doc_created_by_user='BANKPLUS'
        and rcv.financial_account_type='D' and rcv.posting_key in ('11','15')
        and rcv.clearing_accounting_document is null
        and rcv.document_reference_id is not null
        and rcv.document_reference_id = rc.payment_reference)
-- DTZ-265 / gate de classificacao: nao enviar ao XTPG registro sem item de fluxo de
-- caixa (sairia com Flx_de_Caixa vazio). O cron de classificacao carimba e o registro
-- flui no ciclo seguinte.
and   rc.item_fluxo_de_caixa is not null
and   rc.item_fluxo_de_caixa not in ('', '0', '999')
;
