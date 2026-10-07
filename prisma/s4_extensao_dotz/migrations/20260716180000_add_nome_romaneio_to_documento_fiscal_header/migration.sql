-- DTZ-264: nome do arquivo de romaneio de origem, exibido na listagem.
-- Um arquivo pode gerar varios headers (um por codigo de documento/NFVENDA),
-- entao a coluna identifica de qual romaneio cada header veio.
IF COL_LENGTH('dbo.documento_fiscal_header', 'nome_romaneio') IS NULL
BEGIN
    ALTER TABLE [dbo].[documento_fiscal_header] ADD [nome_romaneio] NVARCHAR(255) NULL;
END;
