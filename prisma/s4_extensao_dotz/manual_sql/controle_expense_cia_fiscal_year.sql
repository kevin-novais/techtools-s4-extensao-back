-- DTZ-241: baixa VExpenses: amarrar a conciliacao pela chave do documento SAP
-- (company_code + fiscal_year + accounting_document), evitando falso positivo por
-- colisao de numero de documento entre CIAs/anos. Guardamos a CIA e o ano fiscal do
-- lancamento na controle_expense para escopar a busca em registros_contabeis.
-- Idempotente (SQL Server). Banco compartilhado: aplicar manualmente, NUNCA via migrate deploy.

IF COL_LENGTH('dbo.controle_expense', 'codigo_cia') IS NULL
    ALTER TABLE dbo.controle_expense ADD codigo_cia NVARCHAR(4) NULL;
GO
IF COL_LENGTH('dbo.controle_expense', 'fiscal_year') IS NULL
    ALTER TABLE dbo.controle_expense ADD fiscal_year NVARCHAR(4) NULL;
GO
