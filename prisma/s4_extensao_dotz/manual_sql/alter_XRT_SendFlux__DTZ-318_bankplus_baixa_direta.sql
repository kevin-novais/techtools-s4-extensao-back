/*
    DTZ-318 - Baixa de contas a pagar via BankPlus SEM documento de compensacao.

    Validado com invent (15/09): titulo 1500000147 baixado pelo BankPlus. O previsto saiu
    negativo e o realizado nao foi gerado. Causa: existem duas topologias de baixa BankPlus -
    (1) com doc de compensacao 100000xxx (pagamento e fatura ficam com clearing/is_cleared),
    coberta pelos ramos existentes; e (2) BAIXA DIRETA, sem doc de compensacao, em que
    pagamento e fatura ficam com clearing_accounting_document NULL e o vinculo existe so pela
    assignment_reference do pagamento (pk 21, K). O ramo 20 exige clearing not null e nao
    dispara nessa topologia.

    Correcao (realizado): novo ramo 26 'Pagto Prev Bank Direto', copia do ramo 20 com
    clearing NULL, emitindo +abs (negativo so em reversao) e usando a conta banco do proprio
    documento de pagamento. Ramo 20 (clearing not null) fica intocado.

    Correcao 2 (LCM direto): o filtro do DTZ-302 no ramo 30 era NULL-unsafe. header_text vem
    NULL nos LCM diretos (transferencia entre contas, intercompany), entao
    'NULL not like XTPG%' = UNKNOWN e a linha era descartada - "tudo que e LCM direto nao ia
    no realizado". Passa a isnull(header_text,'') not like 'XTPG%', preservando a exclusao
    dos LCM criados pela SAIDA XTPG (marcados 'XTPG ').

    Correcao 3 (AR, 18/09): ramo 27 'Receb Bank Direto'. Recebimento de contas a RECEBER via
    BankPlus sem doc de compensacao (retorno bancario, clearing NULL). O ramo 25 (Bank Transit)
    so cobre a topologia COM clearing; nessa baixa direta a fatura AR liga ao recebimento por
    payment_reference = document_reference_id. Sem esse ramo o previsto zerava mas o realizado
    (entrada em Bancos Transitoria) nunca era gerado.

    Correcao 4 (imposto retido, 21/09): so o ramo 27 muda. Os ramos 1 e 10 derivam o valor de
    ValorLiquido, que soma as linhas K/D do documento de PAGAMENTO - e nele withholding_tax_amount
    ja e a retencao total (conferido: pagamento 100000123 traz 5.115, exatamente (base-imposto) da
    fatura 5100000320). Por isso o realizado ja emitia o valor certo (103.235) enquanto o previsto
    emitia 106.700: o defeito estava so no previsto. Mexer em ValorLiquido subtrairia a retencao
    duas vezes e quebraria o que esta correto. Os ramos 20, 25, 26, 30 e 40 leem o valor da propria
    linha de banco/caixa, entao tambem nao tem formula de retido para corrigir. O ramo 27 (AR bank
    direto), criado na Correcao 3, era a excecao: emitia o BRUTO da fatura em vez do liquido que
    entra na conta transitoria - corrigido para a mesma retencao efetiva do previsto.

    [RESOLVIDO na Correcao 6, ver abaixo] o ramo 25 (Bank Transit,
    clearing NOT NULL) tem no proprio join a condicao abs(rcv.amount)=abs(fat.amount), ou seja,
    casa a linha do recebimento pelo valor BRUTO da fatura - e por isso emite o bruto. Quando ha
    retencao, o que entra em Bancos Transitoria e o liquido. Caso concreto: fatura 9400000071
    (cia 0401, clearing 100000034) foi pelo ramo 25 e o realizado saiu 2.297,37, enquanto a
    transitoria do recebimento 100000032 recebeu 2.188,92. Corrigir o valor exige repensar aquele
    join (o casamento por valor deixaria de bater), entao fica fora deste ajuste para nao quebrar
    o ramo nos casos sem retencao, que sao a maioria.

    Correcao 6 (ramo 25 com retencao, 02/10): recebimento AR via BankPlus COM clearing e COM
    imposto retido nao gerava realizado. O doc de recebimento (SA, linha D pk 11) vem LIQUIDO e a
    retencao fica no doc de compensacao (AB), entao abs(rcv)=abs(fat) nunca batia e a linha sumia.
    Caso: fatura 9400000108 (cia 0101) 1.148,69, base 71,72, imposto 17,49 -> recebimento 100000137
    = 1.094,46 = 1.148,69 - (71,72 - 17,49). O join passa a aceitar tambem esse valor liquido; o
    Valor ja e o do rcv, entao o realizado sai com o caixa efetivo da transitoria. Sem retencao
    (base <= imposto) o casamento continua so pelo bruto.

    Backup da definicao anterior: _backup_HML_XRT_SendFlux_20260915_pre_DTZ-318.sql
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
-- DTZ-284 (a): ramo 20 (BankPlus) - magnitude, negativo so em reversao. Antes:
-- K -> r21.amount*-1 (forcava AP negativo em todo caso).
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Liq,
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Valor_de_Debito,
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Valor_de_Credito,
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
-- DTZ-318: ramo 26 'Pagto Prev Bank Direto'. Baixa de contas a pagar via BankPlus SEM
-- documento de compensacao (topologia direta): o pagamento (pk 21, K) tem
-- clearing_accounting_document NULL e liga a fatura so pela assignment_reference. O ramo 20
-- exige clearing not null e nao dispara, entao o realizado nunca era gerado (DTZ-318).
-- Espelha o ramo 20 com clearing NULL e usa r21.fiscal_year no lugar de clearing_doc_fiscal_year
-- (que vem nulo) para achar a conta banco do proprio documento de pagamento.
select 
26 ordem,
'Pagto Prev Bank Direto' as BlocoSAP,
'LCM'  as tipo,
rc.Company_code as Empresa,
FORMAT(isnull(rc.Clearing_date, r21.posting_date), 'dd/MM/yyyy')  as Data_de_lancamento,
concat(rc.Company_code,'-',rc.fiscal_year,'-',rc.accounting_document,'-',rc.Accounting_document_item,'-',r21.accounting_document) as Chave_da_transacao,
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
-- DTZ-284 (a): ramo 20 (BankPlus) - magnitude, negativo so em reversao. Antes:
-- K -> r21.amount*-1 (forcava AP negativo em todo caso).
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Liq,
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Valor_de_Debito,
case when r21.is_reversal='X' then -abs(r21.amount_in_company_code_currency) else abs(r21.amount_in_company_code_currency) end as Valor_de_Credito,
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
CROSS APPLY dbo.fn_RetornaContaPagamento(R21.Company_code, R21.accounting_document , r21.fiscal_year ,  rc.debit_credit_code) fncpgt
CROSS APPLY dbo.fn_RetornaContaBancaria(rc.Company_code,  rc.house_bank , rc.house_bank_account , fncpgt.gl_account) fncbank
CROSS APPLY dbo.fn_RetornaContraPartida(rc.Company_code,  rc.accounting_document , rc.Fiscal_Year, rc.Posting_key, rc.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia	cia                ON rc.Company_code = cia.cia_id_sap
LEFT OUTER JOIN  Dotz_Stage_Trocas.dbo.OCRD ocrd     on  isnull(isnull(rc.customer, rc.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where R21.financial_account_type in ('K','D')
and   R21.posting_key ='21'
and   R21.clearing_accounting_document IS NULL
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
-- DTZ-302: ignora os LCMs criados pela SAIDA XTPG (marca 'XTPG ' no header) para o
-- envio nao os reingerir como realizado (round-trip). Cobre original e compensador do estorno.
and   isnull(rc.Accounting_document_header_text,'') not like 'XTPG%'

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
union
-- (b) Ramo 25 'Pagto Prev Bank Transit': recebimento (AR) / pagamento (AP) baixado via
-- BankPlus contra a conta "Bancos Transitoria" (fora do contas_bancarias, pk 11/08/15).
-- Liga a fatura (fat, SUCESSO_PREV) ao doc de recebimento BankPlus (rcv) pelo mesmo
-- clearing_accounting_document, exigindo a contra-linha na transitoria (transit). Sem esse
-- ramo, o previsto zerava mas o realizado nunca era gerado (ramo 10 exclui BankPlus, ramo
-- 20 exige pk 21, ramo 30 exige conta em contas_bancarias e exclui BankPlus).
select
  25 ordem,
  'Pagto Prev Bank Transit' as BlocoSAP,
  'LCM' as tipo,
  fat.Company_code as Empresa,
  FORMAT(isnull(rcv.Clearing_date, rcv.posting_date), 'dd/MM/yyyy') as Data_de_lancamento,
  concat(fat.Company_code,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item,'-',fat.clearing_accounting_document) as Chave_da_transacao,
  fat.Accounting_document_item as Nr_da_Linha,
  isnull(fat.document_reference_id, concat('JE-',fat.accounting_document)) as Referencia_base,
  fat.posting_key as Diario_original,
  case when fat.financial_account_type ='D' then 'AR' when fat.financial_account_type ='K' then 'AP' ELSE 'G/L' end as Diario_original2,
  isnull(fat.document_reference_id, concat('JE-',fat.accounting_document)) as Nr_Nota,
  concat(fat.Company_code,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item,'-',fat.clearing_accounting_document) as Nr_Doc_SAP,
  transit.gl_account as Codigo_da_conta,
  transit.gl_account_long_name as Nome_da_conta,
  fncBank.numero_banco_legado as Banco,
  fncBank.numero_agencia_legado as Agencia,
  fncBank.numero_conta_legado as Conta,
  fncBank.digito_conta_legado as DV,
  fat.item_fluxo_de_caixa as CFWId,
  concat('Descricao ',fat.item_fluxo_de_caixa) as CFWName,
  substring(concat(rcv.Accounting_document_header_text,' ',rcv.document_item_text),1, 44) as LineMemo,
  case when rcv.is_reversal='X' then -abs(rcv.amount_in_company_code_currency) else abs(rcv.amount_in_company_code_currency) end as Liq,
  case when rcv.is_reversal='X' then -abs(rcv.amount_in_company_code_currency) else abs(rcv.amount_in_company_code_currency) end as Valor_de_Debito,
  case when rcv.is_reversal='X' then -abs(rcv.amount_in_company_code_currency) else abs(rcv.amount_in_company_code_currency) end as Valor_de_Credito,
  isnull(isnull(fat.customer, fat.supplier),'') as Cod_Fornecedor,
  substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
  ocrd.CNPJ as CNPJ_Fornecedor,
  case when fat.financial_account_type ='K' then 'T' when fat.financial_account_type ='D' then 'K' else fat.payment_method end as Forma_de_Pagamento,
  -- espelha o ramo 20: contrapartida vem da FATURA (fat), nao do doc de recebimento. Usar
  -- rcv.xtpg_conta_origem trazia uma conta de imposto (ex.: 44007004 Cofins), nao a receita.
  isnull(fat.xtpg_conta_origem, fncCtra.gl_account) as Conta_contabil,
  isnull(isnull(fat.xtpg_conta_origem_nome, fat.xtpg_conta_origem),
         isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
  fncCtra.gl_account as Conta_contrapartida,
  case when fat.financial_account_type ='D' then 'AR' when fat.financial_account_type ='K' then 'AP' ELSE 'G/L' end as OBJ,
  concat(fat.Company_code,'-',fat.clearing_doc_fiscal_year,'-',fat.clearing_accounting_document,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item) as CHAVE,
  -1 as temperatura,
  '0' as Bloco,
  fat.id_xrt as IdXRT,
  DATEDIFF(day, fat.last_change_date, GETDATE()) as NumberOfDays,
  substring (FORMAT(fat.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
  fat.Company_code,
  fat.fiscal_year,
  fat.accounting_document,
  fat.Accounting_document_item,
  fat.clearing_accounting_document,
  fat.clearing_doc_fiscal_year,
  fat.clearing_item,
  fat.reverse_document,
  fat.reverse_document_fiscal_year,
  fat.clearing_doc_fiscal_year p_fiscal_year,
  fat.clearing_accounting_document p_accounting_document,
  fat.clearing_item P_clearing_item,
  'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis fat
inner join s4_extensao_dotz.dbo.registros_contabeis rcv
        on rcv.company_code = fat.company_code
       and rcv.clearing_accounting_document = fat.clearing_accounting_document
       and rcv.accounting_doc_created_by_user = 'BANKPLUS'
       and rcv.accounting_document <> rcv.clearing_accounting_document
       and rcv.financial_account_type = fat.financial_account_type
       and rcv.posting_key <> '21'
       -- Correcao 6 (02/10): com imposto retido o recebimento BankPlus traz o LIQUIDO; casa tambem
       -- por (bruto - (base - imposto)), a mesma retencao efetiva do previsto.
       and (abs(rcv.amount_in_company_code_currency) = abs(fat.amount_in_company_code_currency)
            or (isnull(fat.withholding_tax_base_amount,0) > isnull(fat.withholding_tax_amount,0)
                and abs(rcv.amount_in_company_code_currency) = abs(fat.amount_in_company_code_currency
                    - (fat.withholding_tax_base_amount - isnull(fat.withholding_tax_amount,0)))))
CROSS APPLY (
   select top 1 t.gl_account, t.gl_account_long_name
   from s4_extensao_dotz.dbo.registros_contabeis t
   where t.company_code = rcv.company_code
     and t.accounting_document = rcv.accounting_document
     and t.gl_account_long_name like 'Bancos Transit%'
   order by t.accounting_document_item
) transit
OUTER APPLY dbo.fn_RetornaContaBancaria(fat.Company_code, rcv.house_bank, rcv.house_bank_account, transit.gl_account) fncbank
OUTER APPLY dbo.fn_RetornaContraPartida(fat.Company_code, fat.accounting_document, fat.Fiscal_Year, fat.Posting_key, fat.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia cia ON fat.Company_code = cia.cia_id_sap
LEFT OUTER JOIN Dotz_Stage_Trocas.dbo.OCRD ocrd on isnull(isnull(fat.customer, fat.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where fat.financial_account_type in ('K','D')
and   fat.accounting_doc_created_by_user <> 'BANKPLUS'
and   fat.accounting_document <> fat.clearing_accounting_document
and   fat.clearing_accounting_document is not null
and   fat.reverse_document is null
and   fat.status_para_envio = 'SUCESSO_PREV'
union
-- DTZ-318 AR: ramo 27 'Receb Bank Direto'. Recebimento AR via BankPlus SEM doc de compensacao
-- (retorno bancario, clearing NULL). Espelha o ramo 25 (Bank Transit), mas liga a fatura (fat,
-- SUCESSO_PREV, clearing NULL) ao recebimento BankPlus (rcv, pk 11/15, clearing NULL) por
-- payment_reference = document_reference_id (nessa topologia nao ha clearing para casar). Sem
-- esse ramo o previsto zerava ('Prev liquidados AR Bank Direto') mas o realizado nunca era gerado
-- (ramo 25 exige clearing not null). Conta = Bancos Transitoria do proprio recebimento. Data do
-- lancamento vem do rcv.
-- DTZ-318 imposto retido (21/09): o Valor era o BRUTO da fatura, o que estava errado quando ha
-- retencao - o que entra em Bancos Transitoria e o LIQUIDO. Conferido no recebimento 100000032
-- (cia 0401): a linha pk40 da transitoria trouxe 2.188,92, nao os 2.297,37 do bruto da fatura
-- 9400000071 (2.297,37 - (143,44 - 34,99) = 2.188,92). Passa a usar a mesma retencao efetiva
-- (com guarda) do previsto, o que mantem previsto = realizado = caixa.
-- Ordenacao previsto->realizado garantida pelo reset de status no sync (fatura NULL -> previsto
-- zera e volta a SUCESSO_PREV -> este ramo emite).
select
  27 ordem,
  'Receb Bank Direto' as BlocoSAP,
  'LCM' as tipo,
  fat.Company_code as Empresa,
  FORMAT(isnull(rcv.Clearing_date, rcv.posting_date), 'dd/MM/yyyy') as Data_de_lancamento,
  concat(fat.Company_code,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item,'-',rcv.accounting_document) as Chave_da_transacao,
  fat.Accounting_document_item as Nr_da_Linha,
  isnull(fat.document_reference_id, concat('JE-',fat.accounting_document)) as Referencia_base,
  fat.posting_key as Diario_original,
  case when fat.financial_account_type ='D' then 'AR' when fat.financial_account_type ='K' then 'AP' ELSE 'G/L' end as Diario_original2,
  isnull(fat.document_reference_id, concat('JE-',fat.accounting_document)) as Nr_Nota,
  concat(fat.Company_code,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item,'-',rcv.accounting_document) as Nr_Doc_SAP,
  transit.gl_account as Codigo_da_conta,
  transit.gl_account_long_name as Nome_da_conta,
  fncBank.numero_banco_legado as Banco,
  fncBank.numero_agencia_legado as Agencia,
  fncBank.numero_conta_legado as Conta,
  fncBank.digito_conta_legado as DV,
  fat.item_fluxo_de_caixa as CFWId,
  concat('Descricao ',fat.item_fluxo_de_caixa) as CFWName,
  substring(concat(rcv.Accounting_document_header_text,' ',rcv.document_item_text),1, 44) as LineMemo,
  case when rcv.is_reversal='X' then -abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) else abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) end as Liq,
  case when rcv.is_reversal='X' then -abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) else abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) end as Valor_de_Debito,
  case when rcv.is_reversal='X' then -abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) else abs(fat.amount_in_company_code_currency-(case when isnull(fat.withholding_tax_base_amount,0)=0 or fat.withholding_tax_base_amount=fat.withholding_tax_amount or abs(fat.withholding_tax_base_amount-fat.withholding_tax_amount)>=abs(fat.amount_in_company_code_currency) then isnull(fat.withholding_tax_amount,0) else fat.withholding_tax_base_amount-fat.withholding_tax_amount end)) end as Valor_de_Credito,
  isnull(isnull(fat.customer, fat.supplier),'') as Cod_Fornecedor,
  substring(ocrd.CardName,1,30) as Nome_do_cliente_fornecedor,
  ocrd.CNPJ as CNPJ_Fornecedor,
  case when fat.financial_account_type ='K' then 'T' when fat.financial_account_type ='D' then 'K' else fat.payment_method end as Forma_de_Pagamento,
  isnull(fat.xtpg_conta_origem, fncCtra.gl_account) as Conta_contabil,
  isnull(isnull(fat.xtpg_conta_origem_nome, fat.xtpg_conta_origem),
         isnull(fncCtra.gl_account_name, fncCtra.gl_account)) as Descr_Conta_contabil,
  fncCtra.gl_account as Conta_contrapartida,
  case when fat.financial_account_type ='D' then 'AR' when fat.financial_account_type ='K' then 'AP' ELSE 'G/L' end as OBJ,
  concat(fat.Company_code,'-',rcv.fiscal_year,'-',rcv.accounting_document,'-',fat.fiscal_year,'-',fat.accounting_document,'-',fat.Accounting_document_item) as CHAVE,
  -1 as temperatura,
  '0' as Bloco,
  fat.id_xrt as IdXRT,
  DATEDIFF(day, fat.last_change_date, GETDATE()) as NumberOfDays,
  substring (FORMAT(fat.last_change_date, 'dd/MM/yyyy'), 1, 10) as Data_de_atualizacao,
  fat.Company_code,
  fat.fiscal_year,
  fat.accounting_document,
  fat.Accounting_document_item,
  fat.clearing_accounting_document,
  fat.clearing_doc_fiscal_year,
  fat.clearing_item,
  fat.reverse_document,
  fat.reverse_document_fiscal_year,
  fat.clearing_doc_fiscal_year p_fiscal_year,
  fat.clearing_accounting_document p_accounting_document,
  fat.clearing_item P_clearing_item,
  'SUCESSO_FLUX' as proximo_status
from s4_extensao_dotz.dbo.registros_contabeis fat
inner join s4_extensao_dotz.dbo.registros_contabeis rcv
        on rcv.company_code = fat.company_code
       and rcv.accounting_doc_created_by_user = 'BANKPLUS'
       and rcv.financial_account_type = 'D'
       and rcv.posting_key in ('11','15')
       and rcv.clearing_accounting_document is null
       and rcv.document_reference_id is not null
       and rcv.document_reference_id = fat.payment_reference
CROSS APPLY (
   select top 1 t.gl_account, t.gl_account_long_name
   from s4_extensao_dotz.dbo.registros_contabeis t
   where t.company_code = rcv.company_code
     and t.accounting_document = rcv.accounting_document
     and t.gl_account_long_name like 'Bancos Transit%'
   order by t.accounting_document_item
) transit
OUTER APPLY dbo.fn_RetornaContaBancaria(fat.Company_code, rcv.house_bank, rcv.house_bank_account, transit.gl_account) fncbank
OUTER APPLY dbo.fn_RetornaContraPartida(fat.Company_code, fat.accounting_document, fat.Fiscal_Year, fat.Posting_key, fat.debit_credit_code) fncCtra
INNER JOIN s4_extensao_dotz.dbo.cia cia ON fat.Company_code = cia.cia_id_sap
LEFT OUTER JOIN Dotz_Stage_Trocas.dbo.OCRD ocrd on isnull(isnull(fat.customer, fat.supplier),'X') COLLATE DATABASE_DEFAULT = ocrd.cardcode COLLATE DATABASE_DEFAULT
where fat.financial_account_type = 'D'
and   fat.posting_key in ('01','06')
and   fat.accounting_doc_created_by_user <> 'BANKPLUS'
and   fat.clearing_accounting_document is null
and   fat.reverse_document is null
and   fat.status_para_envio = 'SUCESSO_PREV'
;




