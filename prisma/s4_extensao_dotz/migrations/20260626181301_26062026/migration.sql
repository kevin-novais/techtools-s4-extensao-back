BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- CreateTable
CREATE TABLE [dbo].[xtpg_saida_header] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cia_id] INT,
    [cia_sap] NVARCHAR(50) NOT NULL,
    [parcontabil] NVARCHAR(50) NOT NULL,
    [chave_validacao] NVARCHAR(120) NOT NULL,
    [codigo_sap] NVARCHAR(50),
    [status_sap] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_saida_header_status_sap_df] DEFAULT 'AGUARDANDO',
    [descricao_sap] NVARCHAR(max),
    [data_integracao_sap] DATETIME2,
    [request_sap] NVARCHAR(max),
    [response_sap] NVARCHAR(max),
    [status_xtpg] NVARCHAR(20) NOT NULL CONSTRAINT [xtpg_saida_header_status_xtpg_df] DEFAULT 'AGUARDANDO',
    [descricao_xtpg] NVARCHAR(max),
    [data_integracao_xtpg] DATETIME2,
    [request_xtpg] NVARCHAR(max),
    [response_xtpg] NVARCHAR(max),
    [critica_xtpg] NVARCHAR(max),
    [total_registros] INT NOT NULL CONSTRAINT [xtpg_saida_header_total_registros_df] DEFAULT 0,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_saida_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_saida_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [xtpg_saida_header_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[xtpg_saida_detail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [xtpg_saida_header_id] INT NOT NULL,
    [mvt_contador] NVARCHAR(50),
    [conta_contabil] NVARCHAR(50),
    [conta_contabil_s4] NVARCHAR(30),
    [credito_debito] NVARCHAR(1),
    [valor] NVARCHAR(50),
    [historico] NVARCHAR(max),
    [ind_codigo] NVARCHAR(20),
    [ban_codigo] NVARCHAR(50),
    [age_codigo] NVARCHAR(50),
    [cnt_codigo] NVARCHAR(50),
    [house_bank] NVARCHAR(10),
    [house_bank_account] NVARCHAR(20),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_saida_detail_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [xtpg_saida_detail_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [xtpg_saida_detail_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_saida_header_chave_validacao_idx] ON [dbo].[xtpg_saida_header]([chave_validacao]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_saida_header_status_sap_idx] ON [dbo].[xtpg_saida_header]([status_sap]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_saida_header_status_xtpg_idx] ON [dbo].[xtpg_saida_header]([status_xtpg]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_saida_header_criado_em_idx] ON [dbo].[xtpg_saida_header]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [xtpg_saida_detail_xtpg_saida_header_id_idx] ON [dbo].[xtpg_saida_detail]([xtpg_saida_header_id]);

-- AddForeignKey
ALTER TABLE [dbo].[xtpg_saida_detail] ADD CONSTRAINT [xtpg_saida_detail_xtpg_saida_header_id_fkey] FOREIGN KEY ([xtpg_saida_header_id]) REFERENCES [dbo].[xtpg_saida_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
