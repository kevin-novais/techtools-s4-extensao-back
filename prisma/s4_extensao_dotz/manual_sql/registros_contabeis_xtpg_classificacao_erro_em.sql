IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_classificacao_erro_em') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD xtpg_classificacao_erro_em DATETIME2 NULL;
END
