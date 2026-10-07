BEGIN TRY
BEGIN TRAN;

-- Garante que não existem valores NULL antes de tornar a coluna NOT NULL
-- (atualiza para string vazia temporariamente, se houver)
UPDATE [dbo].[contas_bancarias] SET [codigo_cia] = '' WHERE [codigo_cia] IS NULL;

-- Remove constraints únicas compostas que ficam subsumaidas pela unique em codigo_cia
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_codigo_cia_house_bank_house_bank_account_key];
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_codigo_cia_gl_account_key];

-- Torna codigo_cia NOT NULL
ALTER TABLE [dbo].[contas_bancarias] ALTER COLUMN [codigo_cia] NVARCHAR(10) NOT NULL;

-- Adiciona unique em codigo_cia sozinha
ALTER TABLE [dbo].[contas_bancarias]
    ADD CONSTRAINT [contas_bancarias_codigo_cia_key] UNIQUE ([codigo_cia]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
