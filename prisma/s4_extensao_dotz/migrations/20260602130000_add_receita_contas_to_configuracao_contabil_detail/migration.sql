IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_expiracao') IS NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    ADD [conta_credito_receita_expiracao] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_vendas') IS NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    ADD [conta_credito_receita_vendas] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_resgate') IS NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    ADD [conta_credito_receita_resgate] NVARCHAR(20) NULL;
END;
