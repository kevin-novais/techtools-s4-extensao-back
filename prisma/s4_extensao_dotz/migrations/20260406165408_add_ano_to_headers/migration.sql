BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [vendas_header_ano_df];
ALTER TABLE [dbo].[vendas_header] ADD CONSTRAINT [vendas_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- Backfill: corrige registros existentes para usar o ano de criação real
UPDATE [dbo].[documento_fiscal_header] SET [ano] = YEAR([criado_em]) WHERE [ano] != YEAR([criado_em]);
UPDATE [dbo].[vendas_header] SET [ano] = YEAR([criado_em]) WHERE [ano] != YEAR([criado_em]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
