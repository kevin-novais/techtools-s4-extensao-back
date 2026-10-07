IF COL_LENGTH('dbo.vendas_header', 'numero_fatura_parceiro') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
        ADD [numero_fatura_parceiro] NVARCHAR(30) NULL;
END;
