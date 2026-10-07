BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [digito_agencia] NVARCHAR(3) NULL;

-- AlterTable
ALTER TABLE [dbo].[contas_contabeis] DROP CONSTRAINT [contas_contabeis_data_alteracao_df],
[contas_contabeis_data_inicio_df];
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [gl_account_ecd] NVARCHAR(30) NULL;
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [gl_account_cosif] NVARCHAR(30) NULL;
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [gl_conta_pai_cosif] NVARCHAR(30) NULL;
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [data_inicio] DATETIME2 NULL;
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [data_alteracao] DATETIME2 NULL;
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [data_fim] DATETIME2 NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
