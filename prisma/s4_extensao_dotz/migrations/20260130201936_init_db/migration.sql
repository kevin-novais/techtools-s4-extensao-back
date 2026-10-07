BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[usuarios] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [senha] NVARCHAR(1000) NOT NULL,
    [perfil] NVARCHAR(1000) NOT NULL CONSTRAINT [usuarios_perfil_df] DEFAULT 'USER',
    [ativo] BIT NOT NULL CONSTRAINT [usuarios_ativo_df] DEFAULT 1,
    [avatarUrl] NVARCHAR(1000),
    [atualizado_por] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [usuarios_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [usuarios_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [usuarios_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[tokens_reset_senha] (
    [id] INT NOT NULL IDENTITY(1,1),
    [usuario_id] INT NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [expira_em] DATETIME2 NOT NULL,
    [usado] BIT NOT NULL CONSTRAINT [tokens_reset_senha_usado_df] DEFAULT 0,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [tokens_reset_senha_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tokens_reset_senha_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tokens_reset_senha_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[cia] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nome] NVARCHAR(1000) NOT NULL,
    [cia_id_sap] NVARCHAR(100),
    [ie] NVARCHAR(9),
    [endereco] NVARCHAR(200),
    [municipio] NVARCHAR(100),
    [uf] NVARCHAR(2),
    [cep] NVARCHAR(8),
    [bairro] NVARCHAR(100),
    [cpf_cnpj] NVARCHAR(14),
    [telefone] NVARCHAR(20),
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [cia_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [deletado_em] DATETIME2,
    CONSTRAINT [cia_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[grupo_usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cia_id] INT NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [data_inicio] DATE NOT NULL,
    [data_fim] DATE NOT NULL,
    [aprova_divergencia] BIT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [grupo_usuario_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [deletado_em] DATETIME2,
    CONSTRAINT [grupo_usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [grupo_usuario_nome_key] UNIQUE NONCLUSTERED ([nome])
);

-- CreateTable
CREATE TABLE [dbo].[usuario_grupo_usuario] (
    [usuario_id] INT NOT NULL,
    [grupo_usuario_id] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [usuario_grupo_usuario_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    CONSTRAINT [usuario_grupo_usuario_pkey] PRIMARY KEY CLUSTERED ([usuario_id],[grupo_usuario_id])
);

-- CreateTable
CREATE TABLE [dbo].[documento_fiscal_header] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cia_id] INT NOT NULL,
    [codigo_fornecedor_sap] NVARCHAR(1000),
    [codigo_fornecedor_analyzer] NVARCHAR(1000),
    [codigo_documento] NVARCHAR(100) NOT NULL,
    [tipo_processo] NVARCHAR(1000) NOT NULL CONSTRAINT [documento_fiscal_header_tipo_processo_df] DEFAULT 'TP_ROM',
    [tipo_documento_erp] VARCHAR(20),
    [codigo_documento_erp] NVARCHAR(20),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [documento_fiscal_header_status_df] DEFAULT 'AGUARDANDO',
    [file_url] NVARCHAR(1000),
    [documento_url] NVARCHAR(1000),
    [observacoes_romaneio] NVARCHAR(max),
    [data_aprovacao_romaneio] DATE,
    [aprovado_por_usuario_id] INT,
    [data_emissao] DATE NOT NULL,
    [data_lancamento_contabil] DATE NOT NULL,
    [data_vencimento] DATE,
    [data_processamento_inicio] DATETIME2,
    [data_processamento_fim] DATETIME2,
    [data_integracao] DATETIME2,
    [quantidade_total_pedidos] INT,
    [valor_total_produtos] DECIMAL(19,2),
    [valor_total_pedido] DECIMAL(19,2),
    [valor_total_frete] DECIMAL(19,2),
    [valor_total_combo] DECIMAL(19,2),
    [valor_total_produtos_analyzer] DECIMAL(19,2),
    [valor_total_pedido_analyzer] DECIMAL(19,2),
    [valor_total_frete_analyzer] DECIMAL(19,2),
    [valor_total_combo_analyzer] DECIMAL(19,2),
    [valor_total_is] DECIMAL(19,2),
    [valor_total_cbs] DECIMAL(19,2),
    [valor_total_ibs_uf] DECIMAL(19,2),
    [valor_total_ibs_municipal] DECIMAL(19,2),
    [documento_json] NVARCHAR(max),
    [relatorio_pdf] NVARCHAR(1000),
    [relatorio_xlsx] NVARCHAR(1000),
    [criado_por] INT NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [documento_fiscal_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [documento_fiscal_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [documento_fiscal_header_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [documento_fiscal_header_cia_id_codigo_documento_tipo_processo_key] UNIQUE NONCLUSTERED ([cia_id],[codigo_documento],[tipo_processo])
);

-- CreateTable
CREATE TABLE [dbo].[documento_fiscal_detail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [documento_fiscal_header_id] INT NOT NULL,
    [codigo_documento] NVARCHAR(100) NOT NULL,
    [codigo_fornecedor_sap] NVARCHAR(50),
    [codigo_documento_erp] NVARCHAR(20),
    [item_documento] INT,
    [codigo_produto_dotz] NVARCHAR(20),
    [codigo_produto_fornecedor] NVARCHAR(17),
    [codigo_produto_romaneio] NVARCHAR(20),
    [quantidade_produto_romaneio] INT,
    [descricao_produto_romaneio] NVARCHAR(1000),
    [valor_produto_romaneio] DECIMAL(19,2),
    [valor_pedido_romaneio] DECIMAL(19,2),
    [valor_frete_romaneio] DECIMAL(19,2),
    [valor_combo_romaneio] DECIMAL(19,2),
    [codigo_pedido_parceiro] NVARCHAR(50),
    [codigo_pedido_analyzer] NVARCHAR(50),
    [divergencias] BIT CONSTRAINT [documento_fiscal_detail_divergencias_df] DEFAULT 0,
    [grupo_pis_cofins] NVARCHAR(1),
    [configuracao_contabil_detalhe_id] INT,
    [conta_contabil_credito_custo] NVARCHAR(20),
    [conta_contabil_debito_custo] NVARCHAR(20),
    [conta_contabil_credito_frete] NVARCHAR(20),
    [conta_contabil_debito_frete] NVARCHAR(20),
    [conta_contabil_credito_combo] NVARCHAR(20),
    [conta_contabil_debito_combo] NVARCHAR(20),
    [conta_contabil_credito_pis] NVARCHAR(20),
    [conta_contabil_debito_pis] NVARCHAR(20),
    [conta_contabil_credito_cofins] NVARCHAR(20),
    [conta_contabil_debito_cofins] NVARCHAR(20),
    [conta_contabil_credito_valor_is] NVARCHAR(20),
    [conta_contabil_debito_valor_is] NVARCHAR(20),
    [conta_contabil_credito_valor_cbs] NVARCHAR(20),
    [conta_contabil_debito_valor_cbs] NVARCHAR(20),
    [conta_contabil_credito_valor_ibs_uf] NVARCHAR(20),
    [conta_contabil_debito_valor_ibs_uf] NVARCHAR(20),
    [conta_contabil_credito_valor_ibs_municipal] NVARCHAR(20),
    [conta_contabil_debito_valor_ibs_municipal] NVARCHAR(20),
    [valor_pis_operacao_credor] DECIMAL(19,2),
    [valor_cofins_operacao_credor] DECIMAL(19,2),
    [valor_is] DECIMAL(19,2),
    [valor_cbs] DECIMAL(19,2),
    [valor_ibs_uf] DECIMAL(19,2),
    [valor_ibs_municipal] DECIMAL(19,2),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [documento_fiscal_detail_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 CONSTRAINT [documento_fiscal_detail_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [documento_fiscal_detail_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[documento_fiscal_error] (
    [id] INT NOT NULL IDENTITY(1,1),
    [documento_fiscal_detalhe_id] INT NOT NULL,
    [tipo] NVARCHAR(20) CONSTRAINT [documento_fiscal_error_tipo_df] DEFAULT 'DIVERGENCIA',
    [code] NVARCHAR(50),
    [mensagem] NVARCHAR(max),
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [documento_fiscal_error_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [documento_fiscal_error_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[configuracao_contabil_header] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tipo_processo] NVARCHAR(10) NOT NULL CONSTRAINT [configuracao_contabil_header_tipo_processo_df] DEFAULT 'TP_ROM',
    [cia_id] INT NOT NULL,
    [periodo_de_diferimento] INT,
    [tipo_documento_erp] VARCHAR(20) NOT NULL,
    [texto_header_contabil] NVARCHAR(100),
    [criado_por] INT NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_header_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_header_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [configuracao_contabil_header_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [configuracao_contabil_header_cia_id_tipo_processo_key] UNIQUE NONCLUSTERED ([cia_id],[tipo_processo])
);

-- CreateTable
CREATE TABLE [dbo].[configuracao_contabil_detail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [configuracao_contabil_id] INT NOT NULL,
    [codigo_item] NVARCHAR(20),
    [grupo_pis_cofins] NVARCHAR(1) NOT NULL CONSTRAINT [configuracao_contabil_detail_grupo_pis_cofins_df] DEFAULT 'N',
    [aliquota_pis] DECIMAL(7,4),
    [aliquota_cofins] DECIMAL(7,4),
    [conta_credito_pis] NVARCHAR(20),
    [conta_debito_pis] NVARCHAR(20),
    [conta_credito_cofins] NVARCHAR(20),
    [conta_debito_cofins] NVARCHAR(20),
    [conta_credito_valor_produto] NVARCHAR(20) NOT NULL,
    [conta_debito_valor_produto] NVARCHAR(20),
    [conta_credito_valor_frete] NVARCHAR(20),
    [conta_debito_valor_frete] NVARCHAR(20),
    [conta_credito_valor_combo] NVARCHAR(20),
    [conta_debito_valor_combo] NVARCHAR(20),
    [conta_credito_valor_is] NVARCHAR(20),
    [conta_debito_valor_is] NVARCHAR(20),
    [conta_credito_valor_cbs] NVARCHAR(20),
    [conta_debito_valor_cbs] NVARCHAR(20),
    [conta_credito_valor_ibs_uf] NVARCHAR(20),
    [conta_debito_valor_ibs_uf] NVARCHAR(20),
    [conta_credito_valor_ibs_municipal] NVARCHAR(20),
    [conta_debito_valor_ibs_municipal] NVARCHAR(20),
    [criado_por] INT NOT NULL,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_detail_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_por] INT NOT NULL,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [configuracao_contabil_detail_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [configuracao_contabil_detail_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [configuracao_contabil_detail_configuracao_contabil_id_grupo_pis_cofins_codigo_item_key] UNIQUE NONCLUSTERED ([configuracao_contabil_id],[grupo_pis_cofins],[codigo_item])
);

-- CreateTable
CREATE TABLE [dbo].[controle_expense] (
    [id] INT NOT NULL IDENTITY(1,1),
    [report_id] INT NOT NULL,
    [paying_company_id] INT NOT NULL,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [controle_expense_status_df] DEFAULT 'PENDENTE',
    [codigo_documento_erp] NVARCHAR(50),
    [codigo_sap_colaborador] NVARCHAR(50),
    [codigo_protocolo_vexpenses] NVARCHAR(50),
    [error_message] NVARCHAR(1000),
    [data_importacao] DATETIME2,
    [data_integracao_pagamento] DATETIME2,
    [data_aprovacao] DATETIME2,
    [criado_em] DATETIME2 NOT NULL CONSTRAINT [controle_expense_criado_em_df] DEFAULT CURRENT_TIMESTAMP,
    [atualizado_em] DATETIME2 NOT NULL CONSTRAINT [controle_expense_atualizado_em_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [controle_expense_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[registros_contabeis] (
    [company_code] NVARCHAR(4) NOT NULL,
    [fiscal_year] NVARCHAR(4) NOT NULL,
    [accounting_document] NVARCHAR(10) NOT NULL,
    [accounting_document_item] NVARCHAR(3) NOT NULL,
    [accounting_document_item_type] NVARCHAR(2),
    [clearing_date] DATETIME2,
    [clearing_creation_date] DATETIME2,
    [clearing_accounting_document] NVARCHAR(10),
    [is_cleared] NVARCHAR(1),
    [posting_key] NVARCHAR(2),
    [financial_account_type] NVARCHAR(1),
    [debit_credit_code] NVARCHAR(1),
    [business_area] NVARCHAR(4),
    [partner_business_area] NVARCHAR(4),
    [tax_code] NVARCHAR(2),
    [withholding_tax_code] NVARCHAR(2),
    [tax_type] NVARCHAR(2),
    [transaction_type_determination] NVARCHAR(3),
    [value_date] DATETIME2,
    [assignment_reference] NVARCHAR(18),
    [document_item_text] NVARCHAR(50),
    [controlling_area] NVARCHAR(4),
    [cost_center] NVARCHAR(10),
    [project] NVARCHAR(12),
    [order_id] NVARCHAR(12),
    [billing_document] NVARCHAR(10),
    [sales_document] NVARCHAR(10),
    [sales_document_item] NVARCHAR(6),
    [fixed_asset] NVARCHAR(4),
    [asset_transaction_type] NVARCHAR(3),
    [operational_gl_account] NVARCHAR(10),
    [gl_account] NVARCHAR(10),
    [customer] NVARCHAR(10),
    [supplier] NVARCHAR(10),
    [profit_loss_account_type] NVARCHAR(1),
    [due_calculation_base_date] DATETIME2,
    [payment_terms] NVARCHAR(4),
    [cash_discount_1_days] NVARCHAR(3),
    [cash_discount_2_days] NVARCHAR(3),
    [net_payment_days] NVARCHAR(3),
    [cash_discount_1_percent] DECIMAL(5,3),
    [cash_discount_2_percent] DECIMAL(5,3),
    [payment_reason] NVARCHAR(4),
    [payment_method] NVARCHAR(1),
    [payment_blocking_reason] NVARCHAR(1),
    [house_bank] NVARCHAR(5),
    [bp_bank_account_internal_id] NVARCHAR(4),
    [invoice_reference] NVARCHAR(10),
    [invoice_reference_fiscal_year] NVARCHAR(4),
    [invoice_item_reference] NVARCHAR(3),
    [plant] NVARCHAR(4),
    [purchasing_document] NVARCHAR(10),
    [profit_center] NVARCHAR(10),
    [clearing_is_reversed] NVARCHAR(1),
    [alternative_gl_account] NVARCHAR(10),
    [payment_reference] NVARCHAR(30),
    [clearing_item] NVARCHAR(3),
    [business_place] NVARCHAR(4),
    [functional_area] NVARCHAR(16),
    [clearing_doc_fiscal_year] NVARCHAR(4),
    [house_bank_account] NVARCHAR(5),
    [reference_document_type] NVARCHAR(10),
    [original_reference_document] NVARCHAR(20),
    [fiscal_period] NVARCHAR(3),
    [posting_date] DATETIME2,
    [document_date] DATETIME2,
    [accounting_document_type] NVARCHAR(2),
    [net_due_date] DATETIME2,
    [cash_discount_1_due_date] DATETIME2,
    [cash_discount_2_due_date] DATETIME2,
    [company_code_currency] NVARCHAR(5),
    [amount_in_company_code_currency] DECIMAL(23,2),
    [tax_amount_in_company_code_currency] DECIMAL(23,2),
    [tax_base_amount_in_company_code_currency] DECIMAL(23,2),
    [valuation_diff_amount_in_company_code_currency] DECIMAL(23,2),
    [cash_discount_amount_in_company_code_currency] DECIMAL(23,2),
    [invoice_amount_in_company_code_currency] DECIMAL(23,2),
    [transaction_currency] NVARCHAR(5),
    [amount_in_transaction_currency] DECIMAL(23,2),
    [original_tax_base_amount] DECIMAL(23,2),
    [tax_amount] DECIMAL(23,2),
    [tax_base_amount_in_transaction_currency] DECIMAL(23,2),
    [withholding_tax_base_amount] DECIMAL(23,2),
    [planned_amount_in_transaction_currency] DECIMAL(23,2),
    [cash_discount_base_amount] DECIMAL(23,2),
    [cash_discount_amount] DECIMAL(23,2),
    [net_payment_amount] DECIMAL(23,2),
    [withholding_tax_amount] DECIMAL(23,2),
    [withholding_tax_exemption_amount] DECIMAL(23,2),
    [invoice_amount_in_foreign_currency] DECIMAL(23,2),
    [balance_transaction_currency] NVARCHAR(5),
    [amount_in_balance_transaction_currency] DECIMAL(23,2),
    [additional_currency_1] NVARCHAR(5),
    [valuation_diff_amount_in_additional_currency_1] DECIMAL(23,2),
    [amount_in_additional_currency_1] DECIMAL(23,2),
    [quantity] DECIMAL(13,3),
    [accounting_document_creation_date] DATETIME2,
    [creation_time] NVARCHAR(11),
    [last_change_date] DATETIME2,
    [accounting_doc_created_by_user] NVARCHAR(12),
    [document_reference_id] NVARCHAR(20),
    [reverse_document] NVARCHAR(10),
    [reverse_document_fiscal_year] NVARCHAR(4),
    [accounting_document_header_text] NVARCHAR(25),
    [reversal_reason] NVARCHAR(2),
    [tax_reporting_date] DATETIME2,
    [is_reversal] NVARCHAR(1),
    [is_reversed] NVARCHAR(1),
    CONSTRAINT [registros_contabeis_pkey] PRIMARY KEY CLUSTERED ([company_code],[fiscal_year],[accounting_document],[accounting_document_item])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuarios_nome_email_idx] ON [dbo].[usuarios]([nome], [email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuarios_perfil_idx] ON [dbo].[usuarios]([perfil]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuarios_ativo_idx] ON [dbo].[usuarios]([ativo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tokens_reset_senha_token_idx] ON [dbo].[tokens_reset_senha]([token]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tokens_reset_senha_usuario_id_idx] ON [dbo].[tokens_reset_senha]([usuario_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tokens_reset_senha_expira_em_idx] ON [dbo].[tokens_reset_senha]([expira_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tokens_reset_senha_usado_idx] ON [dbo].[tokens_reset_senha]([usado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cia_nome_idx] ON [dbo].[cia]([nome]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cia_atualizado_por_idx] ON [dbo].[cia]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cia_deletado_em_idx] ON [dbo].[cia]([deletado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_cia_id_idx] ON [dbo].[grupo_usuario]([cia_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_cia_id_deletado_em_idx] ON [dbo].[grupo_usuario]([cia_id], [deletado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_data_inicio_idx] ON [dbo].[grupo_usuario]([data_inicio]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_data_fim_idx] ON [dbo].[grupo_usuario]([data_fim]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_atualizado_por_idx] ON [dbo].[grupo_usuario]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [grupo_usuario_deletado_em_idx] ON [dbo].[grupo_usuario]([deletado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuario_grupo_usuario_usuario_id_idx] ON [dbo].[usuario_grupo_usuario]([usuario_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuario_grupo_usuario_grupo_usuario_id_idx] ON [dbo].[usuario_grupo_usuario]([grupo_usuario_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [usuario_grupo_usuario_atualizado_por_idx] ON [dbo].[usuario_grupo_usuario]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_cia_id_idx] ON [dbo].[documento_fiscal_header]([cia_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_codigo_fornecedor_sap_idx] ON [dbo].[documento_fiscal_header]([codigo_fornecedor_sap]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_codigo_fornecedor_analyzer_idx] ON [dbo].[documento_fiscal_header]([codigo_fornecedor_analyzer]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_codigo_documento_idx] ON [dbo].[documento_fiscal_header]([codigo_documento]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_criado_por_idx] ON [dbo].[documento_fiscal_header]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_criado_em_idx] ON [dbo].[documento_fiscal_header]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_atualizado_por_idx] ON [dbo].[documento_fiscal_header]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_header_atualizado_em_idx] ON [dbo].[documento_fiscal_header]([atualizado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_detail_documento_fiscal_header_id_idx] ON [dbo].[documento_fiscal_detail]([documento_fiscal_header_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_detail_codigo_documento_idx] ON [dbo].[documento_fiscal_detail]([codigo_documento]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_detail_codigo_pedido_parceiro_idx] ON [dbo].[documento_fiscal_detail]([codigo_pedido_parceiro]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documento_fiscal_detail_codigo_fornecedor_sap_idx] ON [dbo].[documento_fiscal_detail]([codigo_fornecedor_sap]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_cia_id_idx] ON [dbo].[configuracao_contabil_header]([cia_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_tipo_processo_idx] ON [dbo].[configuracao_contabil_header]([tipo_processo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_criado_por_idx] ON [dbo].[configuracao_contabil_header]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_criado_em_idx] ON [dbo].[configuracao_contabil_header]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_atualizado_por_idx] ON [dbo].[configuracao_contabil_header]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_header_atualizado_em_idx] ON [dbo].[configuracao_contabil_header]([atualizado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_configuracao_contabil_id_idx] ON [dbo].[configuracao_contabil_detail]([configuracao_contabil_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_codigo_item_idx] ON [dbo].[configuracao_contabil_detail]([codigo_item]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_grupo_pis_cofins_idx] ON [dbo].[configuracao_contabil_detail]([grupo_pis_cofins]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_criado_por_idx] ON [dbo].[configuracao_contabil_detail]([criado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_criado_em_idx] ON [dbo].[configuracao_contabil_detail]([criado_em]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_atualizado_por_idx] ON [dbo].[configuracao_contabil_detail]([atualizado_por]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [configuracao_contabil_detail_atualizado_em_idx] ON [dbo].[configuracao_contabil_detail]([atualizado_em]);

-- AddForeignKey
ALTER TABLE [dbo].[tokens_reset_senha] ADD CONSTRAINT [tokens_reset_senha_usuario_id_fkey] FOREIGN KEY ([usuario_id]) REFERENCES [dbo].[usuarios]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[cia] ADD CONSTRAINT [cia_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[grupo_usuario] ADD CONSTRAINT [grupo_usuario_cia_id_fkey] FOREIGN KEY ([cia_id]) REFERENCES [dbo].[cia]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[grupo_usuario] ADD CONSTRAINT [grupo_usuario_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usuario_grupo_usuario] ADD CONSTRAINT [usuario_grupo_usuario_usuario_id_fkey] FOREIGN KEY ([usuario_id]) REFERENCES [dbo].[usuarios]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[usuario_grupo_usuario] ADD CONSTRAINT [usuario_grupo_usuario_grupo_usuario_id_fkey] FOREIGN KEY ([grupo_usuario_id]) REFERENCES [dbo].[grupo_usuario]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[usuario_grupo_usuario] ADD CONSTRAINT [usuario_grupo_usuario_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_aprovado_por_usuario_id_fkey] FOREIGN KEY ([aprovado_por_usuario_id]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_cia_id_fkey] FOREIGN KEY ([cia_id]) REFERENCES [dbo].[cia]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_header] ADD CONSTRAINT [documento_fiscal_header_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_detail] ADD CONSTRAINT [documento_fiscal_detail_configuracao_contabil_detalhe_id_fkey] FOREIGN KEY ([configuracao_contabil_detalhe_id]) REFERENCES [dbo].[configuracao_contabil_detail]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_detail] ADD CONSTRAINT [documento_fiscal_detail_documento_fiscal_header_id_fkey] FOREIGN KEY ([documento_fiscal_header_id]) REFERENCES [dbo].[documento_fiscal_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documento_fiscal_error] ADD CONSTRAINT [documento_fiscal_error_documento_fiscal_detalhe_id_fkey] FOREIGN KEY ([documento_fiscal_detalhe_id]) REFERENCES [dbo].[documento_fiscal_detail]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_header] ADD CONSTRAINT [configuracao_contabil_header_cia_id_fkey] FOREIGN KEY ([cia_id]) REFERENCES [dbo].[cia]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_header] ADD CONSTRAINT [configuracao_contabil_header_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_header] ADD CONSTRAINT [configuracao_contabil_header_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail] ADD CONSTRAINT [configuracao_contabil_detail_atualizado_por_fkey] FOREIGN KEY ([atualizado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail] ADD CONSTRAINT [configuracao_contabil_detail_criado_por_fkey] FOREIGN KEY ([criado_por]) REFERENCES [dbo].[usuarios]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[configuracao_contabil_detail] ADD CONSTRAINT [configuracao_contabil_detail_configuracao_contabil_id_fkey] FOREIGN KEY ([configuracao_contabil_id]) REFERENCES [dbo].[configuracao_contabil_header]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
