IF COL_LENGTH('dbo.vendas_header', 'periodo_de_diferimento') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [periodo_de_diferimento] INT NULL;
END;
