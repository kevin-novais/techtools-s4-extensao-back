BEGIN TRY

BEGIN TRAN;

IF COL_LENGTH('dbo.relatorio_variavel', 'fuso_horario_brasil') IS NULL
BEGIN
    ALTER TABLE [dbo].[relatorio_variavel]
    ADD [fuso_horario_brasil] BIT NOT NULL
        CONSTRAINT [relatorio_variavel_fuso_horario_brasil_df] DEFAULT 0;
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
