BEGIN TRY

BEGIN TRAN;

-- AddColumn: request/response para auditoria do envio ao SAP.
ALTER TABLE [dbo].[controle_expense] ADD [request] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[controle_expense] ADD [response] NVARCHAR(MAX) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
