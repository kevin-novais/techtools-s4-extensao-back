BEGIN TRY

BEGIN TRAN;

-- Add codigo_cia column with default empty string for existing rows
ALTER TABLE [dbo].[contas_bancarias] ADD [codigo_cia] NVARCHAR(10) NOT NULL CONSTRAINT [contas_bancarias_codigo_cia_df] DEFAULT '';

-- Drop the default constraint so the column has no default going forward
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_codigo_cia_df];

-- Drop existing primary key
ALTER TABLE [dbo].[contas_bancarias] DROP CONSTRAINT [contas_bancarias_pkey];

-- Add new composite primary key including codigo_cia
ALTER TABLE [dbo].[contas_bancarias] ADD CONSTRAINT [contas_bancarias_pkey] PRIMARY KEY CLUSTERED ([codigo_cia], [house_bank], [house_bank_account]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
