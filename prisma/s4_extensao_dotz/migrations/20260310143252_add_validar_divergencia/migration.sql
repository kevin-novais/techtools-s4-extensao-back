BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[configuracao_contabil_detail] ADD [validar_divergencia] BIT NOT NULL CONSTRAINT [configuracao_contabil_detail_validar_divergencia_df] DEFAULT 1;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
