-- =====================================================================
-- DTZ-244 - status_para_envio textual e por fluxo
--   Alarga registros_contabeis.status_para_envio de NVARCHAR(1) p/ NVARCHAR(20)
--   para acomodar os status escritos por fluxo:
--     PREVISTO  -> PROCESSANDO_PREV / SUCESSO_PREV / ERRO_PREV
--     REALIZADO -> PROCESSANDO_FLUX / SUCESSO_FLUX / ERRO_FLUX
--   "Pendente / a enviar" continua sendo NULL (as views filtram IS NULL).
--
-- Idempotente: so altera se a coluna ainda nao comporta 20 chars
-- (COL_LENGTH devolve bytes; NVARCHAR(20) = 40).
-- =====================================================================

IF COL_LENGTH('s4_extensao_dotz.dbo.registros_contabeis', 'status_para_envio') < 40
    ALTER TABLE s4_extensao_dotz.dbo.registros_contabeis
        ALTER COLUMN status_para_envio NVARCHAR(20) NULL;
