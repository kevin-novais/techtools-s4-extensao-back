/*
  Warnings:

  - You are about to alter the column `preco_unitario` on the `vendas_detalhe` table. The data in that column could be lost. The data in that column will be cast from `Decimal(19,2)` to `Decimal(19,6)`.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[vendas_detalhe] ALTER COLUMN [preco_unitario] DECIMAL(19,6) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
