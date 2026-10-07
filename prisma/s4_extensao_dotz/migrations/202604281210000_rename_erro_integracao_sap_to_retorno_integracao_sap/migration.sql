BEGIN TRY

BEGIN TRAN;

/*
  Renomeia coluna no SQL Server (Prisma não gera EXEC sp_rename de forma confiável).
  Mantém dados existentes em erro_integracao_sap -> retorno_integracao_sap.
*/
EXEC sp_rename N'dbo.documento_fiscal_header.erro_integracao_sap', N'retorno_integracao_sap', N'COLUMN';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
