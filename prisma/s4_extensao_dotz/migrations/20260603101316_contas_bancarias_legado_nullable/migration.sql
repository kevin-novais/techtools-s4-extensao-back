-- Torna DigitoConta e GLAccount nullable
ALTER TABLE [contas_bancarias] ALTER COLUMN [digito_conta] NVARCHAR(3) NULL;
ALTER TABLE [contas_bancarias] ALTER COLUMN [gl_account] NVARCHAR(30) NULL;

-- Adiciona colunas LEGADO (todas nullable)
ALTER TABLE [contas_bancarias] ADD [numero_banco_legado] NVARCHAR(10) NULL;
ALTER TABLE [contas_bancarias] ADD [numero_agencia_legado] NVARCHAR(10) NULL;
ALTER TABLE [contas_bancarias] ADD [digito_agencia_legado] NVARCHAR(3) NULL;
ALTER TABLE [contas_bancarias] ADD [numero_conta_legado] NVARCHAR(20) NULL;
ALTER TABLE [contas_bancarias] ADD [digito_conta_legado] NVARCHAR(3) NULL;
