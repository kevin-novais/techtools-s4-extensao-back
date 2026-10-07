-- DTZ-273 - Conta de resultado de origem resolvida fora do caminho de leitura.
-- Preenchida por dbo.sp_ResolveContaOrigemXtpg ao final de cada sync, para que a view
-- leia uma coluna em vez de recorrer o grafo de compensacao por linha.
-- Idempotente (SQL Server). Banco compartilhado: aplicar manualmente, NUNCA via migrate deploy.

IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem NVARCHAR(10) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem_nivel') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem_nivel TINYINT NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem_nome') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem_nome NVARCHAR(100) NULL;
GO
