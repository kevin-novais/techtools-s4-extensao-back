BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[xtpg_envio_previsto_header] (
    [id] INT NOT NULL IDENTITY(1,1),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_envio_previsto_header_status_df] DEFAULT 'PROCESSANDO',
    [total_registros] INT NOT NULL CONSTRAINT [xtpg_envio_previsto_header_total_registros_df] DEFAULT 0,
    [request] NVARCHAR(max),
    [response] NVARCHAR(max),
    [mensagem_erro] NVARCHAR(max),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_envio_previsto_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [criado_por] INT NOT NULL CONSTRAINT [xtpg_envio_previsto_header_criado_por_df] DEFAULT 0,
    [atualizado_em] DATETIME2 NOT NULL,
    [atualizado_por] INT NOT NULL CONSTRAINT [xtpg_envio_previsto_header_atualizado_por_df] DEFAULT 0,
    CONSTRAINT [xtpg_envio_previsto_header_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[xtpg_envio_previsto_detail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [xtpg_envio_previsto_header_id] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_envio_previsto_detail_status_df] DEFAULT 'ENVIADO',
    [id_xrt] NVARCHAR(50),
    [mensagem_erro] NVARCHAR(max),
    [origem_tabela] NVARCHAR(50),
    [origem_doc_entry] NVARCHAR(50),
    [pfj_nome] NVARCHAR(max),
    [pfj_cpf] NVARCHAR(50),
    [ban_codigo] NVARCHAR(50),
    [age_codigo] NVARCHAR(50),
    [cnt_codigo] NVARCHAR(50),
    [tdp_codigo] NVARCHAR(50),
    [doc_pagador] NVARCHAR(20),
    [pfj_codigo] NVARCHAR(50),
    [valor_original] NVARCHAR(50),
    [valor] NVARCHAR(50),
    [doc_origem] NVARCHAR(100),
    [historico] NVARCHAR(max),
    [conta_contabil] NVARCHAR(50),
    [origem_sistema] NVARCHAR(50),
    [origem_pk] NVARCHAR(50),
    [mmi_codigo] NVARCHAR(50),
    [informacoes_contabeis] NVARCHAR(max),
    [data_caixa] NVARCHAR(40),
    [data_competencia] NVARCHAR(40),
    [data_pagamento] NVARCHAR(40),
    [dff01] NVARCHAR(50),
    [dff02] NVARCHAR(100),
    [moeda_codigo] NVARCHAR(10),
    [temperatura] NVARCHAR(10),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_envio_previsto_detail_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL,
    CONSTRAINT [xtpg_envio_previsto_detail_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[xtpg_envio_realizado_header] (
    [id] INT NOT NULL IDENTITY(1,1),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_envio_realizado_header_status_df] DEFAULT 'PROCESSANDO',
    [total_registros] INT NOT NULL CONSTRAINT [xtpg_envio_realizado_header_total_registros_df] DEFAULT 0,
    [request] NVARCHAR(max),
    [response] NVARCHAR(max),
    [mensagem_erro] NVARCHAR(max),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_envio_realizado_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [criado_por] INT NOT NULL CONSTRAINT [xtpg_envio_realizado_header_criado_por_df] DEFAULT 0,
    [atualizado_em] DATETIME2 NOT NULL,
    [atualizado_por] INT NOT NULL CONSTRAINT [xtpg_envio_realizado_header_atualizado_por_df] DEFAULT 0,
    CONSTRAINT [xtpg_envio_realizado_header_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[xtpg_envio_realizado_detail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [xtpg_envio_realizado_header_id] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_envio_realizado_detail_status_df] DEFAULT 'ENVIADO',
    [id_xrt] NVARCHAR(50),
    [mensagem_erro] NVARCHAR(max),
    [origem_tabela] NVARCHAR(50),
    [origem_doc_entry] NVARCHAR(50),
    [pfj_nome] NVARCHAR(max),
    [pfj_cpf] NVARCHAR(50),
    [ban_codigo] NVARCHAR(50),
    [age_codigo] NVARCHAR(50),
    [cnt_codigo] NVARCHAR(50),
    [tdp_codigo] NVARCHAR(50),
    [doc_pagador] NVARCHAR(20),
    [pfj_codigo] NVARCHAR(50),
    [valor_original] NVARCHAR(50),
    [valor] NVARCHAR(50),
    [doc_origem] NVARCHAR(100),
    [historico] NVARCHAR(max),
    [conta_contabil] NVARCHAR(50),
    [origem_sistema] NVARCHAR(50),
    [origem_pk] NVARCHAR(50),
    [mmi_codigo] NVARCHAR(50),
    [informacoes_contabeis] NVARCHAR(max),
    [data_caixa] NVARCHAR(40),
    [data_competencia] NVARCHAR(40),
    [data_pagamento] NVARCHAR(40),
    [dff01] NVARCHAR(50),
    [dff02] NVARCHAR(100),
    [moeda_codigo] NVARCHAR(10),
    [temperatura] NVARCHAR(10),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_envio_realizado_detail_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL,
    CONSTRAINT [xtpg_envio_realizado_detail_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_header_status_idx] ON [dbo].[xtpg_envio_previsto_header]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_header_criado_em_idx] ON [dbo].[xtpg_envio_previsto_header]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_idx] ON [dbo].[xtpg_envio_previsto_detail]([xtpg_envio_previsto_header_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_status_idx] ON [dbo].[xtpg_envio_previsto_detail]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_id_xrt_idx] ON [dbo].[xtpg_envio_previsto_detail]([id_xrt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_header_status_idx] ON [dbo].[xtpg_envio_realizado_header]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_header_criado_em_idx] ON [dbo].[xtpg_envio_realizado_header]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_idx] ON [dbo].[xtpg_envio_realizado_detail]([xtpg_envio_realizado_header_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_status_idx] ON [dbo].[xtpg_envio_realizado_detail]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_id_xrt_idx] ON [dbo].[xtpg_envio_realizado_detail]([id_xrt]);

-- AddForeignKey
ALTER TABLE [dbo].[xtpg_envio_previsto_detail] ADD CONSTRAINT [xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_fkey] FOREIGN KEY ([xtpg_envio_previsto_header_id]) REFERENCES [dbo].[xtpg_envio_previsto_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xtpg_envio_realizado_detail] ADD CONSTRAINT [xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_fkey] FOREIGN KEY ([xtpg_envio_realizado_header_id]) REFERENCES [dbo].[xtpg_envio_realizado_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
