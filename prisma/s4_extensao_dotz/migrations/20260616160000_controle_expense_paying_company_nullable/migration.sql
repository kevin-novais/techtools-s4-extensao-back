BEGIN TRY

BEGIN TRAN;

-- AlterTable: permite nulo em paying_company_id (relatorios descartados antes da
-- integracao podem nao ter empresa pagadora resolvida). Habilita o status DESCARTADO.
ALTER TABLE [dbo].[controle_expense] ALTER COLUMN [paying_company_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
