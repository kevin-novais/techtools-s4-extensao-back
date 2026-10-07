BEGIN TRY

BEGIN TRAN;

-- Adiciona tipo_documento se ainda não existir
IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento') IS NULL
BEGIN
    ALTER TABLE [configuracao_contabil_header]
        ADD [tipo_documento] NVARCHAR(2) NOT NULL DEFAULT '';
END;

-- Preenche o valor correto baseado no tipo_documento_erp existente.
-- EXEC() forçado para que o compilador SQL Server resolva a coluna em runtime
-- (evita erro 207 "Invalid column name" ao compilar o batch antes de executar o ADD).
EXEC('
    UPDATE [configuracao_contabil_header]
    SET [tipo_documento] = CASE [tipo_documento_erp]
        WHEN ''TP_ROM'' THEN ''RE''
        WHEN ''TP_POS'' THEN ''RE''
        WHEN ''PD''     THEN ''PD''
        WHEN ''DR''     THEN ''DR''
        WHEN ''RD''     THEN ''RD''
        ELSE [tipo_documento_erp]
    END
');

-- Remove o DEFAULT temporário de forma dinâmica (o SQL Server gera nomes automáticos)
DECLARE @constraintName NVARCHAR(256);
SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON dc.parent_object_id = c.object_id
   AND dc.parent_column_id = c.column_id
WHERE c.object_id = OBJECT_ID('dbo.configuracao_contabil_header')
  AND c.name = 'tipo_documento';

IF @constraintName IS NOT NULL
    EXEC('ALTER TABLE [dbo].[configuracao_contabil_header] DROP CONSTRAINT [' + @constraintName + ']');

-- Garante que a coluna permanece NOT NULL sem DEFAULT
ALTER TABLE [configuracao_contabil_header]
    ALTER COLUMN [tipo_documento] NVARCHAR(2) NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
