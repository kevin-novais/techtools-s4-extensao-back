IF COL_LENGTH('dbo.vendas_header', 'valor_receita_expiracao') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [valor_receita_expiracao] DECIMAL(19,2) NULL;
END;

IF COL_LENGTH('dbo.vendas_header', 'valor_receita_venda') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [valor_receita_venda] DECIMAL(19,2) NULL;
END;

IF COL_LENGTH('dbo.vendas_header', 'valor_receita_resgate') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [valor_receita_resgate] DECIMAL(19,2) NULL;
END;
