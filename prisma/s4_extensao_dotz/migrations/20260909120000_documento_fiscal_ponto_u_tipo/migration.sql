-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_ponto] ADD [u_tipo] NVARCHAR(20);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_ponto_documento_fiscal_header_id_u_tipo_idx] ON [dbo].[documento_fiscal_ponto]([documento_fiscal_header_id], [u_tipo]);
