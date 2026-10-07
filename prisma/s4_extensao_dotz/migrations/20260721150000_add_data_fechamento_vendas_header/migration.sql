IF COL_LENGTH('dbo.vendas_header', 'DATA_FECHAMENTO_DE') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
        ADD [DATA_FECHAMENTO_DE] DATE NULL;
END;

IF COL_LENGTH('dbo.vendas_header', 'DATA_FECHAMENTO_ATE') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
        ADD [DATA_FECHAMENTO_ATE] DATE NULL;
END;
