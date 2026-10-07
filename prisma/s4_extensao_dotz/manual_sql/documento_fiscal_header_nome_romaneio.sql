/* =====================================================================
   DTZ-264 - nome_romaneio em documento_fiscal_header
   ---------------------------------------------------------------------
   Guarda o nome do arquivo de romaneio de origem, exibido na listagem.
   Um mesmo arquivo passa a gerar um header por codigo de documento
   (coluna NFVENDA), entao a coluna identifica de qual romaneio cada
   header veio.

   Espelha a migration `20260716180000_add_nome_romaneio_to_documento_fiscal_header`.
   Idempotente (COL_LENGTH). Nao registra nada em `_prisma_migrations`.
   ===================================================================== */

IF COL_LENGTH('dbo.documento_fiscal_header', 'nome_romaneio') IS NULL
    ALTER TABLE [dbo].[documento_fiscal_header] ADD [nome_romaneio] NVARCHAR(255) NULL;
