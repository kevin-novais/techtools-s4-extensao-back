BEGIN TRY

BEGIN TRAN;

-- ============================================================
-- 1. Adicionar coluna codigo_documento_erp em vendas_header
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('vendas_header') AND name = 'codigo_documento_erp')
BEGIN
    ALTER TABLE [dbo].[vendas_header] ADD [codigo_documento_erp] NVARCHAR(50);
END;

-- ============================================================
-- 2. Migrar status antigos para novos nomes
-- ============================================================
UPDATE [dbo].[vendas_header] SET [status] = 'INTEG_SAP' WHERE [status] = 'INTEGRADO';
UPDATE [dbo].[vendas_header] SET [status] = 'ERRO_INTEG_SAP' WHERE [status] = 'ERRO_INTEGRACAO';
UPDATE [dbo].[vendas_header] SET [status] = 'ERRO_PROC' WHERE [status] = 'ERRO_PROCESSAMENTO';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW;

END CATCH
