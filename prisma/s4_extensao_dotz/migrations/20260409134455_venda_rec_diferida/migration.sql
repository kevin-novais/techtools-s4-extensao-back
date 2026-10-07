BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [vendas_header_ano_df];
ALTER TABLE [dbo].[vendas_header] ADD CONSTRAINT [vendas_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- CreateTable
CREATE TABLE [dbo].[venda_rec_diferida] (
    [id] INT NOT NULL IDENTITY(1,1),
    [vendas_header_id] INT NOT NULL,
    [periodo_diferimento] SMALLINT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [venda_rec_diferida_status_df] DEFAULT 'PENDENTE',
    [ano] INT,
    [data_emissao] DATE,
    [data_diferimento] DATE,
    [valor_diferimento] DECIMAL(15,2),
    [tipo_contabil_erp] NVARCHAR(20),
    [tipo_documento_erp] NVARCHAR(5),
    [conta_credito] NVARCHAR(20),
    [conta_debito] NVARCHAR(20),
    [centro_lucro] NVARCHAR(20),
    [centro_custo] NVARCHAR(20),
    [ano_fiscal_lancamento] INT,
    [data_integracao] DATE,
    [codigo_documento_erp] NVARCHAR(20),
    [tipo_contabil_erp_reversao] NVARCHAR(20),
    [tipo_documento_erp_reversao] CHAR(5),
    [conta_credito_reversao] NVARCHAR(20),
    [conta_debito_reversao] NVARCHAR(20),
    [centro_lucro_reversao] NVARCHAR(20),
    [centro_custo_reversao] NVARCHAR(20),
    [codigo_documento_erp_reversao] NVARCHAR(20),
    [ano_reversao] INT,
    [data_do_lancamento_da_reversao] DATE,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [venda_rec_diferida_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [venda_rec_diferida_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [venda_rec_diferida_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [venda_rec_diferida_vendas_header_id_periodo_diferimento_key] UNIQUE NONCLUSTERED ([vendas_header_id],[periodo_diferimento])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_venda_rec_diferida_status] ON [dbo].[venda_rec_diferida]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_venda_rec_diferida_data_dif] ON [dbo].[venda_rec_diferida]([data_diferimento]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_venda_rec_diferida_header_id] ON [dbo].[venda_rec_diferida]([vendas_header_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_venda_rec_diferida_ano] ON [dbo].[venda_rec_diferida]([ano]);

-- AddForeignKey
ALTER TABLE [dbo].[venda_rec_diferida] ADD CONSTRAINT [venda_rec_diferida_vendas_header_id_fkey] FOREIGN KEY ([vendas_header_id]) REFERENCES [dbo].[vendas_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
