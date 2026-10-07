BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[relatorio] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nome] VARCHAR(200) NOT NULL,
    [descricao] VARCHAR(500),
    [query] VARCHAR(max) NOT NULL,
    [criado_por] INT NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [relatorio_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT,
    [atualizado_em] DATETIME2 NOT NULL,
    CONSTRAINT [relatorio_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[relatorio_execucao_log] (
    [id] INT NOT NULL IDENTITY(1,1),
    [relatorio_id] INT NOT NULL,
    [executado_por] INT NOT NULL,
    [executado_em] DATETIME2 NOT NULL CONSTRAINT [relatorio_execucao_log_executado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [duracao_ms] INT NOT NULL,
    [total_linhas] INT,
    [status] VARCHAR(10) NOT NULL,
    [mensagem_erro] VARCHAR(max),
    CONSTRAINT [relatorio_execucao_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [relatorio_criado_por_idx] ON [dbo].[relatorio]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [relatorio_criado_em_idx] ON [dbo].[relatorio]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [relatorio_execucao_log_relatorio_id_idx] ON [dbo].[relatorio_execucao_log]([relatorio_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [relatorio_execucao_log_executado_por_idx] ON [dbo].[relatorio_execucao_log]([executado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [relatorio_execucao_log_executado_em_idx] ON [dbo].[relatorio_execucao_log]([executado_em]);

-- AddForeignKey
ALTER TABLE [dbo].[relatorio] ADD CONSTRAINT [relatorio_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[relatorio] ADD CONSTRAINT [relatorio_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[relatorio_execucao_log] ADD CONSTRAINT [relatorio_execucao_log_relatorio_id_fkey] FOREIGN KEY ([relatorio_id]) REFERENCES [dbo].[relatorio]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[relatorio_execucao_log] ADD CONSTRAINT [relatorio_execucao_log_executado_por_fkey] FOREIGN KEY ([executado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
