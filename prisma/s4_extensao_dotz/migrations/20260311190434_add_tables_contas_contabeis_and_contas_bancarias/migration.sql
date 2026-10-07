BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[contas_contabeis] (
    [chart_of_accounts] NVARCHAR(10) NOT NULL,
    [company_code] NVARCHAR(10) NOT NULL,
    [gl_account] NVARCHAR(30) NOT NULL,
    [gl_account_name] NVARCHAR(100) NOT NULL,
    [gl_account_ecd] NVARCHAR(30) NOT NULL,
    [gl_account_cosif] NVARCHAR(30) NOT NULL,
    [gl_conta_pai_cosif] NVARCHAR(30) NOT NULL,
    [item_fluxo_de_caixa] NVARCHAR(10) NOT NULL,
    [data_inicio] DATETIME2 NOT NULL CONSTRAINT [contas_contabeis_data_inicio_df] DEFAULT CURRENT_TIMESTAMP,
    [data_alteracao] DATETIME2 NOT NULL CONSTRAINT [contas_contabeis_data_alteracao_df] DEFAULT CURRENT_TIMESTAMP,
    [data_fim] DATETIME2 NOT NULL,
    CONSTRAINT [contas_contabeis_pkey] PRIMARY KEY CLUSTERED ([chart_of_accounts],[company_code],[gl_account])
);

-- CreateTable
CREATE TABLE [dbo].[contas_bancarias] (
    [house_bank] NVARCHAR(10) NOT NULL,
    [house_bank_account] NVARCHAR(20) NOT NULL,
    [numero_banco] NVARCHAR(10) NOT NULL,
    [numero_agencia] NVARCHAR(10) NOT NULL,
    [nome_banco] NVARCHAR(30) NOT NULL,
    [digito_agencia] NVARCHAR(3) NOT NULL,
    [numero_conta] NVARCHAR(20) NOT NULL,
    [digito_conta] NVARCHAR(3) NOT NULL,
    [gl_account] NVARCHAR(30) NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [contas_bancarias_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [contas_bancarias_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [contas_bancarias_pkey] PRIMARY KEY CLUSTERED ([house_bank],[house_bank_account])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
