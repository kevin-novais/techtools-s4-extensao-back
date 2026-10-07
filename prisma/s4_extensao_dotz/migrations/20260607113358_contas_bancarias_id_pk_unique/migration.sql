BEGIN TRY
BEGIN TRAN;

-- Adiciona coluna id como IDENTITY (valores gerados automaticamente para linhas existentes)
ALTER TABLE [dbo].[contas_bancarias] ADD [id] INT IDENTITY(1,1) NOT NULL;

-- Remove a chave primária composta existente
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_pkey];

-- Define id como nova chave primária
ALTER TABLE [dbo].[contas_bancarias] ADD CONSTRAINT [contas_bancarias_pkey] PRIMARY KEY ([id]);

-- Torna as três colunas nullable (saem da PK)
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [codigo_cia] NVARCHAR(10) NULL;
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [house_bank] NVARCHAR(10) NULL;
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [house_bank_account] NVARCHAR(20) NULL;

-- Adiciona constraint unique no lugar da PK anterior
ALTER TABLE [dbo].[contas_bancarias] ADD CONSTRAINT [contas_bancarias_codigo_cia_house_bank_house_bank_account_key] UNIQUE ([codigo_cia], [house_bank], [house_bank_account]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
