BEGIN TRY

BEGIN TRAN;

-- AlterTable: campos SAP ausentes no registros_contabeis
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'sav_clear_acc_doc')
    ALTER TABLE [dbo].[registros_contabeis] ADD [sav_clear_acc_doc] NVARCHAR(10) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'sav_clear_doc_fiscal_year')
    ALTER TABLE [dbo].[registros_contabeis] ADD [sav_clear_doc_fiscal_year] NVARCHAR(4) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'sav_clear_item')
    ALTER TABLE [dbo].[registros_contabeis] ADD [sav_clear_item] NVARCHAR(3) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'sav_rev_doc')
    ALTER TABLE [dbo].[registros_contabeis] ADD [sav_rev_doc] NVARCHAR(10) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'sav_rev_doc_fiscal_year')
    ALTER TABLE [dbo].[registros_contabeis] ADD [sav_rev_doc_fiscal_year] NVARCHAR(4) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'envio_ID')
    ALTER TABLE [dbo].[registros_contabeis] ADD [envio_ID] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
