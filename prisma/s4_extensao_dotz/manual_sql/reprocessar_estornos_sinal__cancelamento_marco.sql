/*
    Cancelamento Marco - reprocesso dos estornos enviados com sinal errado.

    Contexto: apos o fix do ramo 40 (XRT_SendFlux = -abs(amount)), os cancelamentos
    NOVOS saem negativos. Mas as linhas que ja sairam SUCESSO_FLUX nao sao reenviadas
    sozinhas (saem do gate). Este script as devolve ao gate zerando status_para_envio,
    para o cron do fluxo REALIZADO reenvia-las com o sinal correto (negativo).

    ESCOPO SEGURO: reprocessa SO os estornos cujo ULTIMO envio ao XTPG foi >= 0 (saiu
    errado). Os que ja sairam negativos NAO sao tocados - reenvia-los poderia, sob
    acumulo no XTPG, virar -2x. Conjunto medido em 2026-07-24: 27 linhas (10 D + 17 K).

    Mecanismo identico ao limparFilhosRevertidos (SyncRegistrosContabeisService): o
    reprocesso e "zerar status -> a view reemite -> o cron reenvia". Idempotencia: o
    envio usa OrigemSistema+OrigemPk como chave; e como o valor agora e sempre negativo,
    reenviar nunca piora o saldo (corrige se o XTPG atualiza por chave; aproxima se acumula).

    Depende de: alter_XRT_SendFlux__cancelamento_marco_sinal_estorno.sql ja aplicado.
    Rollback nao se aplica (apenas reabilita reenvio); em caso de duvida, conferir no
    XTPG com o Marco antes de rodar o lote inteiro.
*/

set xact_abort on;

;with est as (
    select rev.company_code, rev.fiscal_year, rev.accounting_document, rev.Accounting_document_item,
           concat(rev.company_code,'-',rev.fiscal_year,'-',rev.accounting_document,'-',
                  rev.Accounting_document_item,'-',rev.reverse_document) as chave
    from s4_extensao_dotz.dbo.registros_contabeis rev
    where rev.is_reversal = 'X'
      and rev.financial_account_type in ('K','D')
      and rev.status_para_envio = 'SUCESSO_FLUX'
      and rev.clearing_accounting_document = rev.accounting_document
      and rev.reverse_document <> rev.clearing_accounting_document
),
ult as (
    select e.company_code, e.fiscal_year, e.accounting_document, e.Accounting_document_item,
           d.valor,
           row_number() over (partition by e.chave order by d.criado_em desc) as rn
    from est e
    join s4_extensao_dotz.dbo.xtpg_envio_realizado_detail d
      on d.origem_pk = e.chave and d.status = 'ENVIADO'
),
alvo as (
    select company_code, fiscal_year, accounting_document, Accounting_document_item
    from ult
    where rn = 1
      and try_convert(decimal(18,2), valor) >= 0   -- ultimo envio positivo = saiu errado
)
update rc
   set rc.status_para_envio = null
  from s4_extensao_dotz.dbo.registros_contabeis rc
  join alvo a
    on a.company_code = rc.company_code
   and a.fiscal_year = rc.fiscal_year
   and a.accounting_document = rc.accounting_document
   and a.Accounting_document_item = rc.Accounting_document_item
 where rc.status_para_envio = 'SUCESSO_FLUX';

select @@rowcount as linhas_reprocessadas;
