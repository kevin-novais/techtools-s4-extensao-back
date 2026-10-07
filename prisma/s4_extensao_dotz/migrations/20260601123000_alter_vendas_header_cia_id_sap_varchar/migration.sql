IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'vendas_header_cia_id_sap_ano_idx'
      AND object_id = OBJECT_ID('[dbo].[vendas_header]')
)
BEGIN
    DROP INDEX [vendas_header_cia_id_sap_ano_idx] ON [dbo].[vendas_header];
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_vendas_header_cia_status'
      AND object_id = OBJECT_ID('[dbo].[vendas_header]')
)
BEGIN
    DROP INDEX [idx_vendas_header_cia_status] ON [dbo].[vendas_header];
END;

ALTER TABLE [dbo].[vendas_header] ALTER COLUMN [cia_id_sap] VARCHAR(100) NOT NULL;

CREATE NONCLUSTERED INDEX [vendas_header_cia_id_sap_ano_idx] ON [dbo].[vendas_header]([cia_id_sap], [ano]);
CREATE NONCLUSTERED INDEX [idx_vendas_header_cia_status] ON [dbo].[vendas_header]([cia_id_sap], [status]);
