IF COL_LENGTH('dbo.vendas_header', 'cnpj_cliente') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
        ADD [cnpj_cliente] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_vendas_header_cnpj'
      AND object_id = OBJECT_ID('dbo.vendas_header')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_vendas_header_cnpj]
        ON [dbo].[vendas_header]([cnpj_cliente]);
END;
