IF COL_LENGTH('dbo.vendas_header', 'retorno_integracao_sap') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [retorno_integracao_sap] NVARCHAR(MAX) NULL;
END;
