IF COL_LENGTH('dbo.vendas_detalhe', 'descricao_produto') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_detalhe]
        ADD [descricao_produto] NVARCHAR(200) NULL;
END;

IF COL_LENGTH('dbo.vendas_detalhe', 'centro_custo') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_detalhe]
        ADD [centro_custo] NVARCHAR(20) NULL;
END;
