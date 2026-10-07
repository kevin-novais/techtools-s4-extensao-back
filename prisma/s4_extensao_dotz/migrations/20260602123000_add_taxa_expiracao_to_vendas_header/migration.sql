IF COL_LENGTH('dbo.vendas_header', 'taxa_expiracao') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [taxa_expiracao] DECIMAL(7,4) NULL;
END;
