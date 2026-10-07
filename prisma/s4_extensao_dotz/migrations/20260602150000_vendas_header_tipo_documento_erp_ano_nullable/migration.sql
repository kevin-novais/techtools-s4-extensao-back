IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'vendas_header_cia_id_sap_ano_idx'
      AND object_id = OBJECT_ID('[dbo].[vendas_header]')
)
BEGIN
    DROP INDEX [vendas_header_cia_id_sap_ano_idx] ON [dbo].[vendas_header];
END;

DECLARE @constraintName NVARCHAR(128);

SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('[dbo].[vendas_header]')
  AND c.name = 'tipo_documento_erp';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [' + @constraintName + ']');
END;

ALTER TABLE [dbo].[vendas_header] ALTER COLUMN [tipo_documento_erp] NVARCHAR(10) NULL;

SET @constraintName = NULL;

SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('[dbo].[vendas_header]')
  AND c.name = 'ano';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [' + @constraintName + ']');
END;

ALTER TABLE [dbo].[vendas_header] ALTER COLUMN [ano] INT NULL;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'vendas_header_cia_id_sap_ano_idx'
      AND object_id = OBJECT_ID('[dbo].[vendas_header]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [vendas_header_cia_id_sap_ano_idx]
    ON [dbo].[vendas_header]([cia_id_sap], [ano]);
END;
