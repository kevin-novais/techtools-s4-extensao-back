BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'contas_bancarias_gl_account_key'
      AND parent_object_id = OBJECT_ID('[dbo].[contas_bancarias]')
      AND type = 'UQ'
)
    ALTER TABLE [dbo].[contas_bancarias]
        ADD CONSTRAINT [contas_bancarias_gl_account_key] UNIQUE ([gl_account]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
