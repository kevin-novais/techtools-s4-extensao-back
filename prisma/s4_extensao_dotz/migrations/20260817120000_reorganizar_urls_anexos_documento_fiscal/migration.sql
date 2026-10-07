-- Reorganiza as colunas de URL/arquivo de anexo em documento_fiscal_header
-- (Romaneio + POS), preservando os dados existentes via sp_rename.
-- Os valores em file_url continuam sendo a URL pública completa do GCS
-- neste momento; a conversão para path relativo e o preenchimento de
-- romaneio_file_name / pos_relatorio_*_file_name é feito pelo backfill
-- do CLI de manutenção (npm run cli -- maintenance backfill-documento-fiscal-urls --apply),
-- que deve ser executado logo após esta migration.

EXEC sp_rename N'dbo.documento_fiscal_header.file_url', N'romaneio_url', N'COLUMN';
EXEC sp_rename N'dbo.documento_fiscal_header.relatorio_pdf', N'pos_relatorio_pdf_url', N'COLUMN';
EXEC sp_rename N'dbo.documento_fiscal_header.relatorio_xlsx', N'pos_relatorio_xlsx_url', N'COLUMN';

ALTER TABLE [dbo].[documento_fiscal_header] DROP COLUMN [documento_url];

ALTER TABLE [dbo].[documento_fiscal_header] ADD [romaneio_file_name] NVARCHAR(255) NULL;
ALTER TABLE [dbo].[documento_fiscal_header] ADD [pos_relatorio_pdf_file_name] NVARCHAR(255) NULL;
ALTER TABLE [dbo].[documento_fiscal_header] ADD [pos_relatorio_xlsx_file_name] NVARCHAR(255) NULL;
