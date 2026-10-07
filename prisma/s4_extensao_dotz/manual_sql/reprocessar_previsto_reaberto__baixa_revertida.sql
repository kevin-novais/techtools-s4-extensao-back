/*
    Reprocesso das faturas cuja BAIXA foi revertida (pagamento cancelado), para que voltem
    ao PREVISTO com o valor original.

    Depende de: alter_XRT_SendPrevPagto__reabrir_previsto_baixa_revertida.sql ja aplicado
    (blocos "Prev reaberto"/"Residual reaberto").

    Por que e necessario: essas linhas ja sairam ao XTPG (status_para_envio='SUCESSO_FLUX',
    a maioria com Valor=0 pelo bloco "Prev liquidados") e por isso nao sao reemitidas
    sozinhas - todos os blocos da view filtram "status_para_envio is null". Zerar o status
    devolve a linha ao gate e o cron do PREVISTO a reenvia com o valor correto.

    Mecanismo identico ao limparFilhosRevertidos (SyncRegistrosContabeisService): "zerar o
    status -> a view reemite -> o cron reenvia". Idempotencia: o envio usa
    OrigemSistema+OrigemPk como chave.

    ESCOPO: apenas linhas K/D cuja baixa foi revertida e que NAO sao elas proprias uma
    reversao (reverse_document is null) - exatamente o conjunto do novo bloco.
    Medido na HML em 2026-07-28: 10 linhas (soma 86.410,25).

    ATENCAO: conferir o resultado com o Marco antes de rodar o lote inteiro; uma das linhas
    medidas (0101-2026-1500000025-2) reabre NEGATIVA (-500), o que pode indicar caso
    particular a validar.
*/

set xact_abort on;

begin tran;

update s4_extensao_dotz.dbo.registros_contabeis
   set status_para_envio = null
 where financial_account_type in ('K', 'D')
   and is_cleared is not null
   and clearing_is_reversed = 'X'
   and reverse_document is null
   and clearing_accounting_document is not null
   and clearing_accounting_document <> accounting_document
   and item_fluxo_de_caixa is not null
   and item_fluxo_de_caixa not in ('', '0', '999')
   and status_para_envio is not null;

declare @n int = @@rowcount;
select 'linhas_reprocessadas' as info, @n as linhas;

-- Guarda: o conjunto medido era de 10 linhas. Uma variacao grande indica que o estado da
-- base mudou desde a analise - nesse caso revisar antes de confirmar.
if @n between 1 and 50
    commit;
else
    rollback;

select 'trancount' as info, @@trancount as valor;
