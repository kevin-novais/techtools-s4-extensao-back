BEGIN TRY

BEGIN TRAN;

-- AlterTable: permite nulo em item_fluxo_de_caixa e xtpg_ativado
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [item_fluxo_de_caixa] NVARCHAR(20) NULL;

-- Remove o default constraint antes de alterar xtpg_ativado para nullable
ALTER TABLE [dbo].[contas_contabeis] DROP CONSTRAINT [contas_contabeis_xtpg_ativado_df];
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [xtpg_ativado] BIT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
