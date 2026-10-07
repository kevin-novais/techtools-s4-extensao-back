-- AlterTable
ALTER TABLE [dbo].[vendas_header] ADD [data_envio_email] DATETIME2 NULL;
ALTER TABLE [dbo].[vendas_header] ADD [destinatario_email] NVARCHAR(255) NULL;
