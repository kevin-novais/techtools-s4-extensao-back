IF COL_LENGTH('s4_extensao_dotz.dbo.controle_expense','nome_colaborador') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.controle_expense ADD [nome_colaborador] NVARCHAR(200) NULL;

IF COL_LENGTH('s4_extensao_dotz.dbo.controle_expense','valor_documento') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.controle_expense ADD [valor_documento] DECIMAL(19,2) NULL;
