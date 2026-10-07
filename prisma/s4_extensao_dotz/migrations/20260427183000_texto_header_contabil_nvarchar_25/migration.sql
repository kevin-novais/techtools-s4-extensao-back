-- Encurtar textos existentes para no máximo 25 caracteres antes de reduzir a coluna
UPDATE [configuracao_contabil_header]
SET [texto_header_contabil] = SUBSTRING([texto_header_contabil], 1, 25)
WHERE [texto_header_contabil] IS NOT NULL;

ALTER TABLE [configuracao_contabil_header] ALTER COLUMN [texto_header_contabil] NVARCHAR(25) NULL;
