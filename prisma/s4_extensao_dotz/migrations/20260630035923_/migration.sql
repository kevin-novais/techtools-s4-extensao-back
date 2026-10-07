BEGIN TRY

BEGIN TRAN;

-- AlterTable
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.configuracao_contabil_detail_ponto') AND name = 'centro_lucro')
    ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD [centro_lucro] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.configuracao_contabil_detail_ponto') AND name = 'conta_credito_receita_expiracao')
    ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD [conta_credito_receita_expiracao] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.configuracao_contabil_detail_ponto') AND name = 'conta_credito_receita_resgate')
    ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD [conta_credito_receita_resgate] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.configuracao_contabil_detail_ponto') AND name = 'conta_credito_receita_vendas')
    ALTER TABLE [dbo].[configuracao_contabil_detail_ponto] ADD [conta_credito_receita_vendas] NVARCHAR(20) NULL;

-- AlterTable
ALTER TABLE [dbo].[documento_fiscal_header] DROP CONSTRAINT [documento_fiscal_header_ano_df];
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_ano_df] DEFAULT YEAR(GETDATE()) FOR [ano];

-- AlterTable
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'Ult_Doc_Pgto')
    ALTER TABLE [dbo].[registros_contabeis] ADD [Ult_Doc_Pgto] NVARCHAR(10) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.registros_contabeis') AND name = 'Ult_PK_Enviada')
    ALTER TABLE [dbo].[registros_contabeis] ADD [Ult_PK_Enviada] NVARCHAR(50) NULL;

-- AlterTable
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'aliquota_cofins')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [aliquota_cofins] DECIMAL(7,4) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'aliquota_pis')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [aliquota_pis] DECIMAL(7,4) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'conta_credito_cofins')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [conta_credito_cofins] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'conta_credito_pis')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [conta_credito_pis] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'conta_debito_cofins')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [conta_debito_cofins] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'conta_debito_pis')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [conta_debito_pis] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'valor_cofins')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [valor_cofins] DECIMAL(12,6) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.vendas_detalhe') AND name = 'valor_pis')
    ALTER TABLE [dbo].[vendas_detalhe] ADD [valor_pis] DECIMAL(12,6) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
