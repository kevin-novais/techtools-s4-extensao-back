-- DTZ-240 – XTPG realizado: colunas de snapshot (sav_*) + id do envio em registros_contabeis.
-- O SAP limpa clearing_*/reverse_* na reversão; congelamos esses valores no momento do envio
-- do realizado para conseguir reverter no XTPG depois. envio_ID = id da xtpg_envio_realizado_detail.
-- Idempotente (SQL Server). Banco compartilhado: aplicar manualmente, NUNCA via migrate deploy.

IF COL_LENGTH('dbo.registros_contabeis', 'sav_clear_acc_doc') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sav_clear_acc_doc NVARCHAR(10) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sav_clear_doc_fiscal_year') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sav_clear_doc_fiscal_year NVARCHAR(4) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sav_clear_item') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sav_clear_item NVARCHAR(3) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sav_rev_doc') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sav_rev_doc NVARCHAR(10) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sav_rev_doc_fiscal_year') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sav_rev_doc_fiscal_year NVARCHAR(4) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'envio_ID') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD envio_ID INT NULL;
GO
