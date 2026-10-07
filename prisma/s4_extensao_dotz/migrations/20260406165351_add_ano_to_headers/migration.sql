BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] ADD [ano] INT NOT NULL CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE());

-- AlterTable
ALTER TABLE [dbo].[vendas_header] ADD [ano] INT NOT NULL CONSTRAINT [vendas_header_ano_df] DEFAULT YEAR(GETDATE());

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_cia_id_ano_idx] ON [dbo].[documento_fiscal_header]([cia_id], [ano]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendas_header_cia_id_ano_idx] ON [dbo].[vendas_header]([cia_id], [ano]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
