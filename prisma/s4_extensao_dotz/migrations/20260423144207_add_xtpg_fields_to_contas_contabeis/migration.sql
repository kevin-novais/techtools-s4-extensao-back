BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[cia] ADD [nome_base_dados_b1] NVARCHAR(128);

-- AlterTable
ALTER TABLE [dbo].[contas_contabeis] ALTER COLUMN [item_fluxo_de_caixa] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[contas_contabeis] ADD [gl_account_b1_xtpg] NVARCHAR(30),
[xtpg_ativado] BIT NOT NULL CONSTRAINT [contas_contabeis_xtpg_ativado_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
ALTER TABLE [dbo].[registros_contabeis] ALTER COLUMN [item_fluxo_de_caixa] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[registros_contabeis] ADD [chart_of_accounts] NVARCHAR(10),
[xtpg_classificacao_erro] NVARCHAR(500);

-- AlterTable
ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [vendas_header_ano_df];
ALTER TABLE [dbo].[vendas_header] ADD CONSTRAINT [vendas_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- CreateTable
CREATE TABLE [dbo].[fluxo_caixa_cia_parceiro] (
    [card_code] NVARCHAR(50) NOT NULL,
    [company_code] NVARCHAR(10) NOT NULL,
    [item_fluxo_caixa] NVARCHAR(20) NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [fluxo_caixa_cia_parceiro_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [fluxo_caixa_cia_parceiro_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [criado_por] INT NOT NULL,
    [atualizado_por] INT NOT NULL,
    CONSTRAINT [fluxo_caixa_cia_parceiro_pkey] PRIMARY KEY CLUSTERED ([card_code],[company_code])
);

-- CreateTable
CREATE TABLE [dbo].[fluxo_caixa_cia_tipo_lancamento] (
    [company_code] NVARCHAR(10) NOT NULL,
    [posting_key] NVARCHAR(2) NOT NULL,
    [document_type] NVARCHAR(2) NOT NULL,
    [reference_document_type] NVARCHAR(10) NOT NULL,
    [is_reversed] NVARCHAR(1) NOT NULL,
    [reversal_reason] NVARCHAR(2) NOT NULL,
    [debit_credit_code] NVARCHAR(1) NOT NULL,
    [item_fluxo_caixa] NVARCHAR(20) NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [fluxo_caixa_cia_tipo_lancamento_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [fluxo_caixa_cia_tipo_lancamento_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [criado_por] INT NOT NULL,
    [atualizado_por] INT NOT NULL,
    CONSTRAINT [fluxo_caixa_cia_tipo_lancamento_pkey] PRIMARY KEY CLUSTERED ([company_code],[posting_key],[document_type],[reference_document_type],[is_reversed],[reversal_reason],[debit_credit_code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fluxo_caixa_cia_parceiro_criado_por_idx] ON [dbo].[fluxo_caixa_cia_parceiro]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fluxo_caixa_cia_parceiro_atualizado_por_idx] ON [dbo].[fluxo_caixa_cia_parceiro]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fluxo_caixa_cia_tipo_lancamento_criado_por_idx] ON [dbo].[fluxo_caixa_cia_tipo_lancamento]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [fluxo_caixa_cia_tipo_lancamento_atualizado_por_idx] ON [dbo].[fluxo_caixa_cia_tipo_lancamento]([atualizado_por]);

-- AddForeignKey
ALTER TABLE [dbo].[fluxo_caixa_cia_parceiro] ADD CONSTRAINT [fluxo_caixa_cia_parceiro_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fluxo_caixa_cia_parceiro] ADD CONSTRAINT [fluxo_caixa_cia_parceiro_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fluxo_caixa_cia_tipo_lancamento] ADD CONSTRAINT [fluxo_caixa_cia_tipo_lancamento_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fluxo_caixa_cia_tipo_lancamento] ADD CONSTRAINT [fluxo_caixa_cia_tipo_lancamento_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
