BEGIN TRY

BEGIN TRAN;

-- documento_fiscal_header.status (só altera se ainda for maior que 30)
IF COL_LENGTH('dbo.documento_fiscal_header', 'status') > 30
BEGIN
    ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
    ALTER TABLE [dbo].[documento_fiscal_header] ALTER COLUMN [status] NVARCHAR(30) NOT NULL;
    ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];
END;

-- relatorio.grupo
IF COL_LENGTH('dbo.relatorio', 'grupo') IS NULL
BEGIN
    ALTER TABLE [dbo].[relatorio] ADD [grupo] VARCHAR(100);
END;

-- relatorio_variavel
IF OBJECT_ID('dbo.relatorio_variavel', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[relatorio_variavel] (
        [id] INT NOT NULL IDENTITY(1,1),
        [relatorio_id] INT NOT NULL,
        [chave] VARCHAR(50) NOT NULL,
        [label] VARCHAR(100) NOT NULL,
        [tipo] VARCHAR(10) NOT NULL,
        [obrigatorio] BIT NOT NULL CONSTRAINT [relatorio_variavel_obrigatorio_df] DEFAULT 1,
        [ordem] INT NOT NULL CONSTRAINT [relatorio_variavel_ordem_df] DEFAULT 0,
        CONSTRAINT [relatorio_variavel_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [relatorio_variavel_relatorio_id_chave_key] UNIQUE NONCLUSTERED ([relatorio_id],[chave])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'relatorio_variavel_relatorio_id_idx'
      AND object_id = OBJECT_ID('dbo.relatorio_variavel')
)
BEGIN
    CREATE NONCLUSTERED INDEX [relatorio_variavel_relatorio_id_idx] ON [dbo].[relatorio_variavel]([relatorio_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'relatorio_grupo_idx'
      AND object_id = OBJECT_ID('dbo.relatorio')
)
BEGIN
    CREATE NONCLUSTERED INDEX [relatorio_grupo_idx] ON [dbo].[relatorio]([grupo]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'relatorio_variavel_relatorio_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[relatorio_variavel] ADD CONSTRAINT [relatorio_variavel_relatorio_id_fkey] FOREIGN KEY ([relatorio_id]) REFERENCES [dbo].[relatorio]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
