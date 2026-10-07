-- CreateTable
CREATE TABLE [dbo].[configuracao_contabil_detail_ponto] (
    [id] INT NOT NULL IDENTITY(1,1),
    [default] BIT NOT NULL CONSTRAINT [configuracao_contabil_detail_ponto_default_df] DEFAULT 0,
    [configuracao_contabil_id] INT NOT NULL,
    [codigo_ponto] NVARCHAR(20),
    [descricao_ponto] NVARCHAR(250),
    [custo_ponto] DECIMAL(7,4),
    [conta_credito] NVARCHAR(20),
    [conta_debito] NVARCHAR(20),
    [grupo_pis_cofins] NVARCHAR(1) NOT NULL CONSTRAINT [configuracao_contabil_detail_ponto_grupo_pis_cofins_df] DEFAULT 'N',
    [aliquota_pis] DECIMAL(7,4),
    [aliquota_cofins] DECIMAL(7,4),
    [conta_credito_pis] NVARCHAR(20),
    [conta_debito_pis] NVARCHAR(20),
    [conta_credito_cofins] NVARCHAR(20),
    [conta_debito_cofins] NVARCHAR(20),
    [criado_por] INT NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_detail_ponto_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_detail_ponto_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [configuracao_contabil_detail_ponto_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [configuracao_contabil_detail_ponto_configuracao_contabil_id_grupo_pis_cofins_codigo_ponto_key] UNIQUE NONCLUSTERED ([configuracao_contabil_id],[grupo_pis_cofins],[codigo_ponto])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_configuracao_contabil_id_idx] ON [dbo].[configuracao_contabil_detail_ponto]([configuracao_contabil_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_codigo_ponto_idx] ON [dbo].[configuracao_contabil_detail_ponto]([codigo_ponto]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_grupo_pis_cofins_idx] ON [dbo].[configuracao_contabil_detail_ponto]([grupo_pis_cofins]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_criado_por_idx] ON [dbo].[configuracao_contabil_detail_ponto]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_criado_em_idx] ON [dbo].[configuracao_contabil_detail_ponto]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_atualizado_por_idx] ON [dbo].[configuracao_contabil_detail_ponto]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_ponto_atualizado_em_idx] ON [dbo].[configuracao_contabil_detail_ponto]([atualizado_em]);

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD CONSTRAINT [configuracao_contabil_detail_ponto_configuracao_contabil_id_fkey] FOREIGN KEY ([configuracao_contabil_id]) REFERENCES [dbo].[configuracao_contabil_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD CONSTRAINT [configuracao_contabil_detail_ponto_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD CONSTRAINT [configuracao_contabil_detail_ponto_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
