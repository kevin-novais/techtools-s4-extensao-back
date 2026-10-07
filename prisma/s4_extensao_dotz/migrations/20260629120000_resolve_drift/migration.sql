-- ==========================================================================
-- Resolução de drift entre o banco de dados e o histórico de migrations.
--
-- Contexto: as tabelas xtpg_saida_* foram criadas pela migration ausente
-- 20260608181622_ com nomes de constraints no padrão DF_/FK_/IX_/PK_,
-- enquanto a migration 20260626181301_26062026 usou o padrão Prisma padrão.
-- Este script normaliza ambos os ambientes (banco real + shadow DB de validação)
-- para os nomes utilizados no banco real.
-- ==========================================================================

-- =====================================================================
-- 1. Colunas ausentes em registros_contabeis
-- =====================================================================
BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'Ult_Doc_Pgto')
    ALTER TABLE [dbo].[registros_contabeis] ADD [Ult_Doc_Pgto] NVARCHAR(10) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'Ult_PK_Enviada')
    ALTER TABLE [dbo].[registros_contabeis] ADD [Ult_PK_Enviada] NVARCHAR(50) NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW
END CATCH

-- =====================================================================
-- 2. Colunas ausentes em venda_rec_diferida
-- =====================================================================
BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.venda_rec_diferida') AND name = 'aliquota_pis')
    ALTER TABLE [dbo].[venda_rec_diferida] ADD [aliquota_pis] DECIMAL(7, 4) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.venda_rec_diferida') AND name = 'aliquota_cofins')
    ALTER TABLE [dbo].[venda_rec_diferida] ADD [aliquota_cofins] DECIMAL(7, 4) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.venda_rec_diferida') AND name = 'mensagem_erro')
    ALTER TABLE [dbo].[venda_rec_diferida] ADD [mensagem_erro] NVARCHAR(max) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.venda_rec_diferida') AND name = 'valor_pis')
    ALTER TABLE [dbo].[venda_rec_diferida] ADD [valor_pis] DECIMAL(19, 6) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.venda_rec_diferida') AND name = 'valor_cofins')
    ALTER TABLE [dbo].[venda_rec_diferida] ADD [valor_cofins] DECIMAL(19, 6) NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW
END CATCH

-- =====================================================================
-- 3. integration_execution_log: PK e índice
-- (sp_rename não funciona dentro de transação)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'integration_execution_log_pkey')
    EXEC sp_rename 'integration_execution_log_pkey', 'PK_integration_execution_log';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'integration_execution_log_integration_key_started_at_idx' AND object_id = OBJECT_ID('dbo.integration_execution_log'))
    EXEC sp_rename N'[dbo].[integration_execution_log].[integration_execution_log_integration_key_started_at_idx]', N'IX_integration_execution_log_key_started', 'INDEX';

-- =====================================================================
-- 4. xtpg_saida_header: PK
-- Shadow DB tem 'xtpg_saida_header_pkey'; banco real tem nome auto-gerado.
-- Ambos renomeados para 'PK_xtpg_saida_header'.
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'xtpg_saida_header_pkey')
    EXEC sp_rename 'xtpg_saida_header_pkey', 'PK_xtpg_saida_header';

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK__xtpg_sai__3213E83FD5D9D92A')
    EXEC sp_rename 'PK__xtpg_sai__3213E83FD5D9D92A', 'PK_xtpg_saida_header';

-- =====================================================================
-- 5. xtpg_saida_header: defaults de status/total (somente shadow DB)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_header_status_sap_df')
    EXEC sp_rename 'xtpg_saida_header_status_sap_df', 'DF_xtpg_saida_header_status_sap';

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_header_status_xtpg_df')
    EXEC sp_rename 'xtpg_saida_header_status_xtpg_df', 'DF_xtpg_saida_header_status_xtpg';

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_header_total_registros_df')
    EXEC sp_rename 'xtpg_saida_header_total_registros_df', 'DF_xtpg_saida_header_total';

-- =====================================================================
-- 6. xtpg_saida_header: defaults de timestamp (rename + troca para sysdatetime)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_header_criado_em_df' AND parent_object_id = OBJECT_ID('dbo.xtpg_saida_header'))
BEGIN
    ALTER TABLE [dbo].[xtpg_saida_header] DROP CONSTRAINT [xtpg_saida_header_criado_em_df];
    ALTER TABLE [dbo].[xtpg_saida_header] ADD CONSTRAINT [DF_xtpg_saida_header_criado] DEFAULT sysdatetime() FOR [criado_em];
END;

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_header_atualizado_em_df' AND parent_object_id = OBJECT_ID('dbo.xtpg_saida_header'))
BEGIN
    ALTER TABLE [dbo].[xtpg_saida_header] DROP CONSTRAINT [xtpg_saida_header_atualizado_em_df];
    ALTER TABLE [dbo].[xtpg_saida_header] ADD CONSTRAINT [DF_xtpg_saida_header_atualizado] DEFAULT sysdatetime() FOR [atualizado_em];
END;

-- =====================================================================
-- 7. xtpg_saida_header: índices (somente shadow DB — banco real já tem IX_*)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_saida_header_chave_validacao_idx' AND object_id = OBJECT_ID('dbo.xtpg_saida_header'))
    EXEC sp_rename N'[dbo].[xtpg_saida_header].[xtpg_saida_header_chave_validacao_idx]', N'IX_xtpg_saida_header_chave', 'INDEX';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_saida_header_status_sap_idx' AND object_id = OBJECT_ID('dbo.xtpg_saida_header'))
    EXEC sp_rename N'[dbo].[xtpg_saida_header].[xtpg_saida_header_status_sap_idx]', N'IX_xtpg_saida_header_ssap', 'INDEX';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_saida_header_status_xtpg_idx' AND object_id = OBJECT_ID('dbo.xtpg_saida_header'))
    EXEC sp_rename N'[dbo].[xtpg_saida_header].[xtpg_saida_header_status_xtpg_idx]', N'IX_xtpg_saida_header_sxtpg', 'INDEX';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_saida_header_criado_em_idx' AND object_id = OBJECT_ID('dbo.xtpg_saida_header'))
    EXEC sp_rename N'[dbo].[xtpg_saida_header].[xtpg_saida_header_criado_em_idx]', N'IX_xtpg_saida_header_criado', 'INDEX';

-- =====================================================================
-- 8. xtpg_saida_detail: PK
-- Shadow DB tem 'xtpg_saida_detail_pkey'; banco real tem nome auto-gerado.
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'xtpg_saida_detail_pkey')
    EXEC sp_rename 'xtpg_saida_detail_pkey', 'PK_xtpg_saida_detail';

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK__xtpg_sai__3213E83F2149B95E')
    EXEC sp_rename 'PK__xtpg_sai__3213E83F2149B95E', 'PK_xtpg_saida_detail';

-- =====================================================================
-- 9. xtpg_saida_detail: FK (somente shadow DB — banco real já tem FK_*)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'xtpg_saida_detail_xtpg_saida_header_id_fkey')
    EXEC sp_rename 'xtpg_saida_detail_xtpg_saida_header_id_fkey', 'FK_xtpg_saida_detail_header';

-- =====================================================================
-- 10. xtpg_saida_detail: defaults de timestamp (rename + troca para sysdatetime)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_detail_criado_em_df' AND parent_object_id = OBJECT_ID('dbo.xtpg_saida_detail'))
BEGIN
    ALTER TABLE [dbo].[xtpg_saida_detail] DROP CONSTRAINT [xtpg_saida_detail_criado_em_df];
    ALTER TABLE [dbo].[xtpg_saida_detail] ADD CONSTRAINT [DF_xtpg_saida_detail_criado] DEFAULT sysdatetime() FOR [criado_em];
END;

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'xtpg_saida_detail_atualizado_em_df' AND parent_object_id = OBJECT_ID('dbo.xtpg_saida_detail'))
BEGIN
    ALTER TABLE [dbo].[xtpg_saida_detail] DROP CONSTRAINT [xtpg_saida_detail_atualizado_em_df];
    ALTER TABLE [dbo].[xtpg_saida_detail] ADD CONSTRAINT [DF_xtpg_saida_detail_atualizado] DEFAULT sysdatetime() FOR [atualizado_em];
END;

-- =====================================================================
-- 11. xtpg_saida_detail: índice (somente shadow DB)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'xtpg_saida_detail_xtpg_saida_header_id_idx' AND object_id = OBJECT_ID('dbo.xtpg_saida_detail'))
    EXEC sp_rename N'[dbo].[xtpg_saida_detail].[xtpg_saida_detail_xtpg_saida_header_id_idx]', N'IX_xtpg_saida_detail_header', 'INDEX';
