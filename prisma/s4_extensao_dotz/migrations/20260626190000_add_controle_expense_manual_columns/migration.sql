-- Colunas aplicadas manualmente no banco compartilhado (ver manual_sql/).
-- Adicionadas aqui para manter o histórico de migrations local em sync.

IF COL_LENGTH('dbo.controle_expense', 'nome_colaborador') IS NULL
    ALTER TABLE dbo.controle_expense ADD nome_colaborador NVARCHAR(200) NULL;

IF COL_LENGTH('dbo.controle_expense', 'valor_documento') IS NULL
    ALTER TABLE dbo.controle_expense ADD valor_documento DECIMAL(19,2) NULL;

IF COL_LENGTH('dbo.controle_expense', 'codigo_cia') IS NULL
    ALTER TABLE dbo.controle_expense ADD codigo_cia NVARCHAR(4) NULL;

IF COL_LENGTH('dbo.controle_expense', 'fiscal_year') IS NULL
    ALTER TABLE dbo.controle_expense ADD fiscal_year NVARCHAR(4) NULL;
