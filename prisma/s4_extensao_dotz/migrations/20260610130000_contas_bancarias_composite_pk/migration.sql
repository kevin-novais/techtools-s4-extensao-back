BEGIN TRY
BEGIN TRAN;

-- Remove unique constraint em codigo_cia
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_codigo_cia_key];

-- Remove PK atual (em id)
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_pkey];

-- Remove coluna id (IDENTITY)
ALTER TABLE [dbo].[contas_bancarias] DROP COLUMN [id];

-- Preenche valores NULL antes de tornar NOT NULL
UPDATE [dbo].[contas_bancarias] SET [house_bank] = '' WHERE [house_bank] IS NULL;
UPDATE [dbo].[contas_bancarias] SET [house_bank_account] = '' WHERE [house_bank_account] IS NULL;

-- Torna house_bank e house_bank_account NOT NULL
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [house_bank] NVARCHAR(10) NOT NULL;
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [house_bank_account] NVARCHAR(20) NOT NULL;

-- Adiciona PK composta (codigo_cia, house_bank, house_bank_account)
ALTER TABLE [dbo].[contas_bancarias] ADD CONSTRAINT [contas_bancarias_pkey] PRIMARY KEY CLUSTERED ([codigo_cia], [house_bank], [house_bank_account]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
