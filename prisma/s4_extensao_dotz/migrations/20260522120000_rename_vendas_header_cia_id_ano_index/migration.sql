BEGIN TRY

BEGIN TRAN;

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'vendas_header_cia_id_ano_idx'
      AND object_id = OBJECT_ID('dbo.vendas_header')
)
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'vendas_header_cia_id_sap_ano_idx'
      AND object_id = OBJECT_ID('dbo.vendas_header')
)
BEGIN
    EXEC SP_RENAME N'dbo.vendas_header.vendas_header_cia_id_ano_idx', N'vendas_header_cia_id_sap_ano_idx', N'INDEX';
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
