/* =====================================================================
   XTPG Envio - Tabelas de LOG (avulso / idempotente)
   ---------------------------------------------------------------------
   Cria APENAS as 4 tabelas de log do módulo de envio XTPG, sem tocar em
   nenhuma tabela existente. Espelha a migration Prisma
   `20260602170000_add_xtpg_envio_log_tables` (inclui a coluna `temperatura`).

   Uso: rodar no banco `s4_extensao_dotz`. Seguro re-executar (IF NOT EXISTS).
   Objetivo: viabilizar o teste do serviço sem depender de `prisma migrate`
   (o banco está com histórico de migrations à frente / com migration falha).

   Observação: este script NÃO registra nada em `_prisma_migrations`. Quando o
   módulo for integrado ao repo atualizado da equipe, usar a migration Prisma
   oficial para manter o histórico consistente.
   ===================================================================== */

SET XACT_ABORT ON;
BEGIN TRAN;

/* ----------------------------- PREVISTO ----------------------------- */
IF OBJECT_ID('dbo.xtpg_envio_previsto_header', 'U') IS NULL
BEGIN
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
END;

IF OBJECT_ID('dbo.xtpg_envio_previsto_detail', 'U') IS NULL
BEGIN
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
END;

/* ----------------------------- REALIZADO ---------------------------- */
IF OBJECT_ID('dbo.xtpg_envio_realizado_header', 'U') IS NULL
BEGIN
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
END;

IF OBJECT_ID('dbo.xtpg_envio_realizado_detail', 'U') IS NULL
BEGIN
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
END;

/* ----------------------------- ÍNDICES ------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_previsto_header_status_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_previsto_header'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_header_status_idx] ON [dbo].[xtpg_envio_previsto_header]([status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_previsto_header_criado_em_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_previsto_header'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_header_criado_em_idx] ON [dbo].[xtpg_envio_previsto_header]([criado_em]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_previsto_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_idx] ON [dbo].[xtpg_envio_previsto_detail]([xtpg_envio_previsto_header_id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_previsto_detail_status_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_previsto_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_status_idx] ON [dbo].[xtpg_envio_previsto_detail]([status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_previsto_detail_id_xrt_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_previsto_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_previsto_detail_id_xrt_idx] ON [dbo].[xtpg_envio_previsto_detail]([id_xrt]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_realizado_header_status_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_realizado_header'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_header_status_idx] ON [dbo].[xtpg_envio_realizado_header]([status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_realizado_header_criado_em_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_realizado_header'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_header_criado_em_idx] ON [dbo].[xtpg_envio_realizado_header]([criado_em]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_realizado_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_idx] ON [dbo].[xtpg_envio_realizado_detail]([xtpg_envio_realizado_header_id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_realizado_detail_status_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_realizado_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_status_idx] ON [dbo].[xtpg_envio_realizado_detail]([status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_envio_realizado_detail_id_xrt_idx' AND object_id = OBJECT_ID('dbo.xtpg_envio_realizado_detail'))
    CREATE NONCLUSTERED INDEX [xtpg_envio_realizado_detail_id_xrt_idx] ON [dbo].[xtpg_envio_realizado_detail]([id_xrt]);

/* ------------------------------ FKs --------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_fkey')
    ALTER TABLE [dbo].[xtpg_envio_previsto_detail]
        ADD CONSTRAINT [xtpg_envio_previsto_detail_xtpg_envio_previsto_header_id_fkey]
        FOREIGN KEY ([xtpg_envio_previsto_header_id]) REFERENCES [dbo].[xtpg_envio_previsto_header]([id])
        ON DELETE CASCADE ON UPDATE NO ACTION;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_fkey')
    ALTER TABLE [dbo].[xtpg_envio_realizado_detail]
        ADD CONSTRAINT [xtpg_envio_realizado_detail_xtpg_envio_realizado_header_id_fkey]
        FOREIGN KEY ([xtpg_envio_realizado_header_id]) REFERENCES [dbo].[xtpg_envio_realizado_header]([id])
        ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;
