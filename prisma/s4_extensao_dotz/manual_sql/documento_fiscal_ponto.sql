-- Script manual equivalente a migration 20260824120000_add_documento_fiscal_ponto (DTZ-297)
-- Executar apenas se a migration Prisma nao puder ser aplicada automaticamente.
-- Log/snapshot das configuracoes contabeis de PONTO usadas no calculo enviado ao SAP numa troca.
-- Ids de configuracao gravados como VALOR (sem FK) para o historico nao quebrar quando a config
-- muda/e apagada; unica FK e o documento fiscal a que o log pertence (Cascade).

IF OBJECT_ID('dbo.documento_fiscal_ponto', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[documento_fiscal_ponto] (
        [id] INT NOT NULL IDENTITY(1,1),
        [documento_fiscal_header_id] INT NOT NULL,
        [configuracao_contabil_header_id] INT NOT NULL,
        [configuracao_contabil_detalhe_ponto_id] INT,
        [codigo_ponto] NVARCHAR(20),
        [descricao_ponto] NVARCHAR(250),
        [custo_ponto] DECIMAL(19,6),
        [conta_credito] NVARCHAR(20),
        [conta_debito] NVARCHAR(20),
        [grupo_pis_cofins] NVARCHAR(1) NOT NULL CONSTRAINT [documento_fiscal_ponto_grupo_pis_cofins_df] DEFAULT 'N',
        [aliquota_pis] DECIMAL(7,4),
        [conta_credito_pis] NVARCHAR(20),
        [conta_debito_pis] NVARCHAR(20),
        [aliquota_cofins] DECIMAL(7,4),
        [conta_credito_cofins] NVARCHAR(20),
        [conta_debito_cofins] NVARCHAR(20),
        [criado_em] DATETIME2 NOT NULL CONSTRAINT [documento_fiscal_ponto_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [documento_fiscal_ponto_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [documento_fiscal_ponto_documento_fiscal_header_id_idx] ON [dbo].[documento_fiscal_ponto]([documento_fiscal_header_id]);
    CREATE NONCLUSTERED INDEX [documento_fiscal_ponto_configuracao_contabil_header_id_idx] ON [dbo].[documento_fiscal_ponto]([configuracao_contabil_header_id]);
    CREATE NONCLUSTERED INDEX [documento_fiscal_ponto_codigo_ponto_idx] ON [dbo].[documento_fiscal_ponto]([codigo_ponto]);
    CREATE NONCLUSTERED INDEX [documento_fiscal_ponto_criado_em_idx] ON [dbo].[documento_fiscal_ponto]([criado_em]);

    ALTER TABLE [dbo].[documento_fiscal_ponto] ADD CONSTRAINT [documento_fiscal_ponto_documento_fiscal_header_id_fkey] FOREIGN KEY ([documento_fiscal_header_id]) REFERENCES [dbo].[documento_fiscal_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
END;
