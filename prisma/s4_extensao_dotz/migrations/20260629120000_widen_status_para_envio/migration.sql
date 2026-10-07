BEGIN TRY

BEGIN TRAN;

-- DTZ-244: status_para_envio passa a ser textual e por fluxo
-- (PROCESSANDO_PREV/SUCESSO_PREV/ERRO_PREV e *_FLUX). Alarga de NVARCHAR(1) p/ NVARCHAR(20).
-- AlterColumn
ALTER TABLE [dbo].[registros_contabeis] ALTER COLUMN [status_para_envio] NVARCHAR(20);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
