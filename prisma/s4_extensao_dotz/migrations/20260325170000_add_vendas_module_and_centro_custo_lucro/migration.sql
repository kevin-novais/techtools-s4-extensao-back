BEGIN TRY

BEGIN TRAN;

-- ============================================================
-- 1. Adicionar centro_custo e centro_lucro em ConfiguracaoContabilDetalhe
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('configuracao_contabil_detail') AND name = 'centro_custo')
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail] ADD [centro_custo] NVARCHAR(20);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('configuracao_contabil_detail') AND name = 'centro_lucro')
BEGIN
    ALTER TABLE [dbo].[configuracao_contabil_detail] ADD [centro_lucro] NVARCHAR(20);
END;

-- ============================================================
-- 2. Adicionar centro_custo e centro_lucro em DocumentoFiscalDetalhe
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('documento_fiscal_detail') AND name = 'centro_custo')
BEGIN
    ALTER TABLE [dbo].[documento_fiscal_detail] ADD [centro_custo] NVARCHAR(20);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('documento_fiscal_detail') AND name = 'centro_lucro')
BEGIN
    ALTER TABLE [dbo].[documento_fiscal_detail] ADD [centro_lucro] NVARCHAR(20);
END;

-- ============================================================
-- 3. Criar tabela vendas_header (se não existir)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'vendas_header')
BEGIN
    CREATE TABLE [dbo].[vendas_header] (
        [id] INT NOT NULL IDENTITY(1,1),
        [cia_id] INT NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [vendas_header_status_df] DEFAULT 'PENDENTE',
        [codigo_cliente_analyzer] NVARCHAR(50),
        [codigo_cliente_sap] NVARCHAR(50),
        [numero_documento_analyzer] NVARCHAR(50),
        [info_referencia_analyzer] NVARCHAR(max),
        [cnpj_cliente] NVARCHAR(14),
        [valor_total_vendas] DECIMAL(19,2),
        [path_arquivo_fatura_detalhada_analyzer] NVARCHAR(1000),
        [path_arquivo_relatorio_analitico] NVARCHAR(1000),
        [data_emissao] DATE,
        [data_lancamento_contabil] DATE,
        [data_vencimento] DATE,
        [documento_json] NVARCHAR(max),
        [data_integracao] DATETIME2,
        [relatorio_pdf] NVARCHAR(500),
        [relatorio_xlsx] NVARCHAR(500),
        [criado_em] DATETIME2 NOT NULL CONSTRAINT [vendas_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
        [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [vendas_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [vendas_header_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [idx_vendas_header_status] ON [dbo].[vendas_header]([status]);
    CREATE NONCLUSTERED INDEX [idx_vendas_header_cia_status] ON [dbo].[vendas_header]([cia_id], [status]);
    CREATE NONCLUSTERED INDEX [idx_vendas_header_cnpj] ON [dbo].[vendas_header]([cnpj_cliente]);
    CREATE NONCLUSTERED INDEX [idx_vendas_header_data_emissao] ON [dbo].[vendas_header]([data_emissao]);
    CREATE NONCLUSTERED INDEX [idx_vendas_header_cliente_sap] ON [dbo].[vendas_header]([codigo_cliente_sap]);
    CREATE NONCLUSTERED INDEX [idx_vendas_header_doc_analyzer] ON [dbo].[vendas_header]([numero_documento_analyzer]);
END;

-- Adicionar colunas de integração caso a tabela já exista mas sem elas
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'vendas_header')
    AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('vendas_header') AND name = 'documento_json')
BEGIN
    ALTER TABLE [dbo].[vendas_header] ADD [documento_json] NVARCHAR(max);
    ALTER TABLE [dbo].[vendas_header] ADD [data_integracao] DATETIME2;
    ALTER TABLE [dbo].[vendas_header] ADD [relatorio_pdf] NVARCHAR(500);
    ALTER TABLE [dbo].[vendas_header] ADD [relatorio_xlsx] NVARCHAR(500);
END;

-- ============================================================
-- 4. Criar tabela vendas_detalhe (se não existir)
--    Já com centro_lucro (não centro_custo)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'vendas_detalhe')
BEGIN
    CREATE TABLE [dbo].[vendas_detalhe] (
        [id] INT NOT NULL IDENTITY(1,1),
        [vendas_header_id] INT NOT NULL,
        [item_documento] INT,
        [codigo_produto_dotz] NVARCHAR(20),
        [centro_lucro] NVARCHAR(20),
        [quantidade_pontos] INT,
        [valor_venda] DECIMAL(19,2),
        [preco_unitario] DECIMAL(19,2),
        [custo_pontos] DECIMAL(23,6),
        [criado_em] DATETIME2 NOT NULL CONSTRAINT [vendas_detalhe_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
        [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [vendas_detalhe_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [vendas_detalhe_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [idx_vendas_detalhe_header_id] ON [dbo].[vendas_detalhe]([vendas_header_id]);
    CREATE NONCLUSTERED INDEX [idx_vendas_detalhe_produto] ON [dbo].[vendas_detalhe]([codigo_produto_dotz]);

    ALTER TABLE [dbo].[vendas_detalhe] ADD CONSTRAINT [vendas_detalhe_vendas_header_id_fkey]
        FOREIGN KEY ([vendas_header_id]) REFERENCES [dbo].[vendas_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
END;

-- Se vendas_detalhe já existe com centro_custo, renomear para centro_lucro
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('vendas_detalhe') AND name = 'centro_custo')
    AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('vendas_detalhe') AND name = 'centro_lucro')
BEGIN
    EXEC sp_rename 'vendas_detalhe.centro_custo', 'centro_lucro', 'COLUMN';
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
