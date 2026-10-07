IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_expiracao') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    DROP COLUMN [conta_credito_receita_expiracao];
END;

IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_vendas') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    DROP COLUMN [conta_credito_receita_vendas];
END;

IF COL_LENGTH('dbo.configuracao_contabil_detail', 'conta_credito_receita_resgate') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail]
    DROP COLUMN [conta_credito_receita_resgate];
END;
