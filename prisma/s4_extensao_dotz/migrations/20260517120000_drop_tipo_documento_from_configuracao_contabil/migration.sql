BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento') IS NOT NULL
    BEGIN
        DECLARE @constraintName NVARCHAR(256);
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE c.object_id = OBJECT_ID('dbo.configuracao_contabil_header')
          AND c.name = 'tipo_documento';

        IF @constraintName IS NOT NULL
            EXEC('ALTER TABLE [dbo].[configuracao_contabil_header] DROP CONSTRAINT [' + @constraintName + ']');

        ALTER TABLE [dbo].[configuracao_contabil_header] DROP COLUMN [tipo_documento];
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
