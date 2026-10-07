-- =====================================================================
-- Write-back pos-envio XTPG (Everaldo): colunas em registros_contabeis
--   Ult_PK_Enviada  NVARCHAR(50)  <- DocEntry (envio previsto / XRT_SendPrevPagto)
--   Ult_Doc_Pgto    NVARCHAR(10)  <- clearing_accounting_document (envio realizado / XRT_SendFlux)
--
-- Em homolog essas colunas JA foram criadas pelo Everaldo. Este script e
-- idempotente (COL_LENGTH) para os demais ambientes que ainda nao as tenham.
-- =====================================================================

IF COL_LENGTH('s4_extensao_dotz.dbo.registros_contabeis', 'Ult_PK_Enviada') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.registros_contabeis ADD Ult_PK_Enviada NVARCHAR(50) NULL;

IF COL_LENGTH('s4_extensao_dotz.dbo.registros_contabeis', 'Ult_Doc_Pgto') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.registros_contabeis ADD Ult_Doc_Pgto NVARCHAR(10) NULL;
