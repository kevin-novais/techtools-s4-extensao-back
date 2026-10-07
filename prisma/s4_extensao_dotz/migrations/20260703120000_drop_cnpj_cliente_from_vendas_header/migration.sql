IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_vendas_header_cnpj'
      AND object_id = OBJECT_ID('dbo.vendas_header')
)
BEGIN
    DROP INDEX [idx_vendas_header_cnpj] ON [dbo].[vendas_header];
END

IF COL_LENGTH('dbo.vendas_header', 'cnpj_cliente') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header] DROP COLUMN [cnpj_cliente];
END
