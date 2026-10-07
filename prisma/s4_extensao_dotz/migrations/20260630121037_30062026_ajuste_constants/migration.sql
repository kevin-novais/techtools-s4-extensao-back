BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
