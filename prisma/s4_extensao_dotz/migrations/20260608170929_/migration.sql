/*
  Warnings:

  - You are about to alter the column `valor_venda` on the `vendas_detalhe` table. The data in that column could be lost. The data in that column will be cast from `Decimal(19,6)` to `Decimal(19,2)`.
  - You are about to alter the column `preco_unitario` on the `vendas_detalhe` table. The data in that column could be lost. The data in that column will be cast from `Decimal(19,6)` to `Decimal(19,2)`.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
ALTER TABLE [dbo].[vendas_detalhe] ALTER COLUMN [valor_venda] DECIMAL(19,2) NULL;
ALTER TABLE [dbo].[vendas_detalhe] ALTER COLUMN [preco_unitario] DECIMAL(19,2) NULL;

-- AlterTable
ALTER TABLE [dbo].[xtpg_envio_previsto_detail] ADD CONSTRAINT [xtpg_envio_previsto_detail_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP FOR [atualizado_em];

-- AlterTable
ALTER TABLE [dbo].[xtpg_envio_previsto_header] ADD CONSTRAINT [xtpg_envio_previsto_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP FOR [atualizado_em];

-- AlterTable
ALTER TABLE [dbo].[xtpg_envio_realizado_detail] ADD CONSTRAINT [xtpg_envio_realizado_detail_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP FOR [atualizado_em];

-- AlterTable
ALTER TABLE [dbo].[xtpg_envio_realizado_header] ADD CONSTRAINT [xtpg_envio_realizado_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP FOR [atualizado_em];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
