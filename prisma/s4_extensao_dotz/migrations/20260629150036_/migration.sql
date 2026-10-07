BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
ALTER TABLE [dbo].[xtpg_saida_detail] DROP CONSTRAINT [DF_xtpg_saida_detail_atualizado],
[DF_xtpg_saida_detail_criado];
ALTER TABLE [dbo].[xtpg_saida_detail] ADD CONSTRAINT [xtpg_saida_detail_atualizado_em_df] DEFAULT sysdatetime() FOR [atualizado_em], CONSTRAINT [xtpg_saida_detail_criado_em_df] DEFAULT sysdatetime() FOR [criado_em];

-- AlterTable
ALTER TABLE [dbo].[xtpg_saida_header] DROP CONSTRAINT [DF_xtpg_saida_header_atualizado],
[DF_xtpg_saida_header_criado],
[DF_xtpg_saida_header_status_sap],
[DF_xtpg_saida_header_status_xtpg],
[DF_xtpg_saida_header_total];
ALTER TABLE [dbo].[xtpg_saida_header] ADD CONSTRAINT [xtpg_saida_header_atualizado_em_df] DEFAULT sysdatetime() FOR [atualizado_em], CONSTRAINT [xtpg_saida_header_criado_em_df] DEFAULT sysdatetime() FOR [criado_em], CONSTRAINT [xtpg_saida_header_status_sap_df] DEFAULT 'AGUARDANDO' FOR [status_sap], CONSTRAINT [xtpg_saida_header_status_xtpg_df] DEFAULT 'AGUARDANDO' FOR [status_xtpg], CONSTRAINT [xtpg_saida_header_total_registros_df] DEFAULT 0 FOR [total_registros];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
