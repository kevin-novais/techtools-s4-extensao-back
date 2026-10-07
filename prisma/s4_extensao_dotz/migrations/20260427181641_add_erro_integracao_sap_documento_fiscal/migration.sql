BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];
ALTER TABLE [dbo].[documento_fiscal_header] ADD [erro_integracao_sap] NVARCHAR(max);

-- AlterTable
ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [vendas_header_ano_df];
ALTER TABLE [dbo].[vendas_header] ADD CONSTRAINT [vendas_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
