BEGIN TRY
BEGIN TRAN;

IF EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'contas_bancarias_gl_account_key'
      AND parent_object_id = OBJECT_ID('[dbo].[contas_bancarias]')
      AND type = 'UQ'
)
    ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_gl_account_key];

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
