BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.vendas_header', 'cia_id') IS NOT NULL
    BEGIN
        EXEC sp_rename 'dbo.vendas_header.cia_id', 'cia_id_sap', 'COLUMN';
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
